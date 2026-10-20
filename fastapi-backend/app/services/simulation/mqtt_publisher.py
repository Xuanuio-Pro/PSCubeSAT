"""MQTT publisher used by the simulator workers."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

import aiomqtt
from loguru import logger

from app.core.config import get_settings
from app.core.mqtt_transport import mqtt_tls_context


class SimulationMqttPublisher:
    """Maintain one MQTT connection and publish simulator frames."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._client: Optional[aiomqtt.Client] = None
        self._task: Optional[asyncio.Task[None]] = None
        self._connected = asyncio.Event()
        self._stopping = asyncio.Event()
        self._publish_lock = asyncio.Lock()

    @property
    def connected(self) -> bool:
        return self._connected.is_set()

    async def start(self) -> None:
        if self._task and not self._task.done():
            return

        self._stopping.clear()
        self._task = asyncio.create_task(
            self._connection_loop(),
            name="simulation-mqtt-publisher",
        )
        logger.info("[SIM MQTT] Publisher task started")

    async def stop(self) -> None:
        self._stopping.set()
        self._connected.clear()

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        self._task = None
        self._client = None
        logger.info("[SIM MQTT] Publisher stopped")

    async def publish(self, payload: dict[str, Any]) -> None:
        """Publish one canonical frame to the device telemetry topic."""
        device_uid = payload.get("device_id")
        if not isinstance(device_uid, str) or not device_uid:
            raise ValueError("Simulator telemetry thiếu device_id")

        if not self._task or self._task.done():
            raise RuntimeError("Simulation MQTT publisher chưa được start")

        try:
            await asyncio.wait_for(self._connected.wait(), timeout=10.0)
        except asyncio.TimeoutError as exc:
            raise RuntimeError("Simulator MQTT broker chưa kết nối") from exc

        topic = f"sensors/{device_uid}/telemetry"
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

        async with self._publish_lock:
            client = self._client
            if client is None:
                raise RuntimeError("Simulator MQTT client không sẵn sàng")
            await client.publish(topic, raw, qos=1)

        logger.debug(f"[SIM MQTT] Published topic={topic} seq={payload.get('seq')}")

    async def _connection_loop(self) -> None:
        reconnect_delay = 1

        while not self._stopping.is_set():
            try:
                tls_context = mqtt_tls_context(self._settings)

                logger.info(
                    f"[SIM MQTT] Kết nối → {self._settings.mqtt_host}:{self._settings.mqtt_port}"
                )

                async with aiomqtt.Client(
                    hostname=self._settings.mqtt_host,
                    port=self._settings.mqtt_port,
                    username=self._settings.mqtt_username,
                    password=self._settings.mqtt_password,
                    tls_context=tls_context,
                ) as client:
                    self._client = client
                    self._connected.set()
                    reconnect_delay = 1
                    logger.success("[SIM MQTT] Đã kết nối broker")

                    # aiomqtt's message iterator wakes on broker disconnect,
                    # even without subscriptions. Waiting only on stop hid outages.
                    async for _ in client.messages:
                        pass
                    raise aiomqtt.MqttError("MQTT stream ended")

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning(
                    f"[SIM MQTT] Connection failed: {type(exc).__name__}; retry in {reconnect_delay}s"
                )
            finally:
                self._connected.clear()
                self._client = None
            if not self._stopping.is_set():
                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, 30)


simulation_mqtt_publisher = SimulationMqttPublisher()
