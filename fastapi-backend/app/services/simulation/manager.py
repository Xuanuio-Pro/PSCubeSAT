"""Manage simulator sessions and publish generated frames through an injected callback."""

from __future__ import annotations

import asyncio
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from loguru import logger

TelemetryPublisher = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass
class SimulationSession:
    """Runtime state for one simulated device."""

    session_id: str
    user_id: int
    device_id: int
    device_uid: str
    config: dict[str, Any]
    status: str = "stopped"
    seq: int = 0
    scenario_time: float = 0.0
    task: Optional[asyncio.Task[None]] = field(default=None, repr=False)
    pause_event: asyncio.Event = field(default_factory=asyncio.Event, repr=False)

    def __post_init__(self) -> None:
        # A newly created session is allowed to run once started.
        self.pause_event.set()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.session_id,
            "user_id": self.user_id,
            "device_id": self.device_id,
            "device_uid": self.device_uid,
            "status": self.status,
            "seq": self.seq,
            "config": self.config,
        }


class SimulationManager:
    """Own simulator tasks while keeping transport and HTTP dependencies outside the manager."""

    def __init__(
        self,
        publisher: Optional[TelemetryPublisher] = None,
        tick_hz: float = 20.0,
    ) -> None:
        if tick_hz <= 0:
            raise ValueError("tick_hz phải lớn hơn 0")

        self._publisher = publisher
        self._interval = 1.0 / tick_hz
        self._sessions: dict[str, SimulationSession] = {}
        self._lock = asyncio.Lock()

    async def create(
        self,
        user_id: int,
        device_id: int,
        config: dict[str, Any],
        *,
        session_id: Optional[str] = None,
        device_uid: str,
    ) -> SimulationSession:
        """Create a stopped session for one simulated device."""
        session_id = session_id or f"sim-session-{uuid.uuid4().hex[:12]}"
        session = SimulationSession(
            session_id=session_id,
            user_id=user_id,
            device_id=device_id,
            device_uid=device_uid,
            config=dict(config),
        )

        async with self._lock:
            if session_id in self._sessions:
                raise ValueError(f"Simulation session đã tồn tại: {session_id}")
            self._sessions[session_id] = session

        logger.info(
            f"[SIM] Tạo session={session.session_id} "
            f"device={session.device_uid} user_id={session.user_id}"
        )
        return session

    async def start(self, session_id: str) -> SimulationSession:
        session = self.get(session_id)

        if session.status == "running":
            return session

        if session.task and not session.task.done():
            session.pause_event.set()
            session.status = "running"
            return session

        session.pause_event.set()
        session.status = "running"
        session.task = asyncio.create_task(
            self._run(session),
            name=f"simulation:{session.session_id}",
        )
        logger.info(f"[SIM] Start session={session.session_id}")
        return session

    async def pause(self, session_id: str) -> SimulationSession:
        session = self.get(session_id)
        if session.status == "running":
            session.pause_event.clear()
            session.status = "paused"
            logger.info(f"[SIM] Pause session={session.session_id}")
        return session

    async def resume(self, session_id: str) -> SimulationSession:
        session = self.get(session_id)
        if session.status == "paused":
            session.pause_event.set()
            session.status = "running"
            logger.info(f"[SIM] Resume session={session.session_id}")
        return session

    async def reset(self, session_id: str) -> SimulationSession:
        session = self.get(session_id)
        session.seq = 0
        session.scenario_time = 0.0
        session.config["scenario_time"] = 0.0
        session.status = "stopped"
        session.pause_event.set()
        logger.info(f"[SIM] Reset session={session.session_id}")
        return session

    async def stop(self, session_id: str) -> SimulationSession:
        session = self.get(session_id)
        session.status = "stopped"
        session.pause_event.set()

        task = session.task
        session.task = None
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        logger.info(f"[SIM] Stop session={session.session_id}")
        return session

    async def delete(self, session_id: str) -> None:
        session = self.get(session_id)
        await self.stop(session_id)
        async with self._lock:
            self._sessions.pop(session_id, None)
        logger.info(f"[SIM] Delete session={session.session_id}")

    def set_publisher(self, publisher: Optional[TelemetryPublisher]) -> None:
        """Attach or detach the transport used by future worker frames."""
        self._publisher = publisher

    def get(self, session_id: str) -> SimulationSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(f"Không tìm thấy simulation session: {session_id}")
        return session

    def list_for_user(self, user_id: int) -> list[SimulationSession]:
        return [session for session in self._sessions.values() if session.user_id == user_id]

    async def shutdown(self) -> None:
        """Stop all tasks during FastAPI shutdown."""
        sessions = list(self._sessions.values())
        for session in sessions:
            await self.stop(session.session_id)
        self._sessions.clear()

    async def _run(self, session: SimulationSession) -> None:
        try:
            while session.status in {"running", "paused"}:
                # When paused, this waits without generating or publishing frames.
                await session.pause_event.wait()

                telemetry = self._generate_telemetry(session)
                session.seq += 1

                if self._publisher is not None:
                    await self._publisher(telemetry)
                else:
                    logger.debug(
                        f"[SIM] frame device={session.device_uid} "
                        f"seq={session.seq} payload={telemetry}"
                    )

                await asyncio.sleep(self._interval)
        except asyncio.CancelledError:
            raise
        except Exception:
            session.status = "error"
            logger.exception(f"[SIM] Worker lỗi session={session.session_id}")

    def _generate_telemetry(self, session: SimulationSession) -> dict[str, Any]:
        """Generate one canonical telemetry frame for the MVP scenarios."""
        t = session.scenario_time
        session.scenario_time += self._interval
        session.config["scenario_time"] = session.scenario_time

        scenario = session.config.get("scenario", "idle")
        rotation = 1.0 if scenario in {"rotation", "shake"} else 0.0
        shake = 0.08 if scenario == "shake" else 0.0
        thermal = 2.0 * math.sin(t * 0.25) if scenario == "thermal" else 0.0
        battery_drop = 0.0005 * t if scenario == "battery_drain" else 0.0

        return {
            "device_id": session.device_uid,
            "source": "simulator",
            "seq": session.seq + 1,
            "timestamp": int(datetime.now(timezone.utc).timestamp()),
            "acc": {
                "x": rotation * 0.15 * math.sin(t) + shake * math.sin(t * 17),
                "y": rotation * 0.15 * math.cos(t) + shake * math.cos(t * 13),
                "z": 1.0 + shake * math.sin(t * 19),
            },
            "gyro": {
                "x": rotation * 2.0 * math.sin(t),
                "y": rotation * 2.0 * math.cos(t),
                "z": rotation * 0.5,
            },
            "temperature": 25.0 + thermal,
            "voltage": max(3.0, 3.8 - battery_drop),
            "gps": {
                "lat": 21.0285,
                "lon": 105.8542,
                "alt": 10.0,
            },
        }


simulation_manager = SimulationManager()
