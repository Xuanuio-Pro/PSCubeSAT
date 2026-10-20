import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import Integer
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.exceptions import register_exception_handlers
from app.core.security import create_access_token
from app.db import get_db
from app.models.tables import Base, Device, GoogleIdentity, RevokedToken, User
from app.models.telemetry import TelemetryFrame, TelemetryPayload
from app.routers import auth, devices, progress, simulations, telemetry
from app.services import mqtt_consumer


class PlatformTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        original = User.__table__.c.id.type
        User.__table__.c.id.type = original.with_variant(Integer(), "sqlite")
        self.addCleanup(lambda: setattr(User.__table__.c.id, "type", original))
        async with self.engine.begin() as conn:
            await conn.run_sync(
                lambda c: Base.metadata.create_all(
                    c,
                    tables=[
                        User.__table__,
                        Device.__table__,
                        GoogleIdentity.__table__,
                        RevokedToken.__table__,
                    ],
                )
            )
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.sessions() as db:
            db.add_all(
                [
                    User(id=1, email="a@example.com", password_hash="unused", role="user"),
                    User(id=2, email="b@example.com", password_hash="unused", role="user"),
                ]
            )
            await db.flush()
            db.add_all(
                [
                    Device(
                        id=1,
                        user_id=1,
                        device_uid="device-a",
                        device_name="A",
                        enabled=True,
                        last_lat=0,
                        last_lon=0,
                    ),
                    Device(
                        id=2,
                        user_id=2,
                        device_uid="device-b",
                        device_name="B",
                        enabled=True,
                        last_lat=1,
                        last_lon=1,
                    ),
                    Device(
                        id=3,
                        user_id=1,
                        device_uid="disabled",
                        device_name="Disabled",
                        enabled=False,
                    ),
                    Device(
                        id=4,
                        user_id=1,
                        device_uid="deleted",
                        device_name="Deleted",
                        enabled=True,
                        deleted_at=datetime.now(timezone.utc),
                    ),
                ]
            )
            await db.commit()
        app = FastAPI()
        for router in [
            auth.router,
            devices.router,
            simulations.router,
            telemetry.router,
            progress.router,
        ]:
            app.include_router(router)
        register_exception_handlers(app)

        async def test_db():
            async with self.sessions() as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        self.redis = patch("app.services.auth.get_redis", return_value=None)
        self.redis.start()
        self.a = create_access_token({"sub": "1"})
        self.b = create_access_token({"sub": "2"})
        mqtt_consumer._latest_state.clear()
        mqtt_consumer._latest_state.update(
            {uid: {"device_id": uid} for uid in ["device-a", "device-b", "disabled", "deleted"]}
        )

    async def asyncTearDown(self):
        self.redis.stop()
        await self.client.aclose()
        await self.engine.dispose()
        mqtt_consumer._latest_state.clear()
        mqtt_consumer._last_position_write.clear()

    def headers(self, token):
        return {"Authorization": "Bearer " + token}

    async def test_device_and_progress_validation(self):
        for lab in (-1, 9, 100000):
            for action in ("video-watched", "doc-viewed"):
                response = await self.client.post(
                    f"/api/progress/{lab}/{action}", headers=self.headers(self.a)
                )
                self.assertEqual(response.status_code, 422)
        for body in (
            {"lat": 91, "lon": 0},
            {"lat": 0, "lon": -181},
            {"lat": True, "lon": 0},
            {"lat": "21", "lon": 0},
        ):
            response = await self.client.patch(
                "/api/devices/device-a/position", json=body, headers=self.headers(self.a)
            )
            self.assertEqual(response.status_code, 422)
        for body in (
            {"device_name": "  "},
            {"device_name": "x" * 129},
            {"device_name": "Cube", "device_type": "unexpected"},
        ):
            response = await self.client.post(
                "/api/devices/register", json=body, headers=self.headers(self.a)
            )
            self.assertEqual(response.status_code, 422)
        from app.schemas.device import CreateDeviceRequest, UpdatePositionRequest

        for axis in ("lat", "lon", "alt"):
            for number in (float("nan"), float("inf"), -float("inf")):
                with self.assertRaises(ValidationError):
                    UpdatePositionRequest.model_validate({"lat": 0, "lon": 0, axis: number})
        self.assertEqual(UpdatePositionRequest(lat=0, lon=0, alt=0).lat, 0)
        for kind in ("hardware", "simulator", "ground_station"):
            self.assertEqual(
                CreateDeviceRequest(device_name=" Cube ", device_type=kind).device_name, "Cube"
            )

    async def test_rest_isolation_and_positions(self):
        for path in [
            "/api/telemetry/latest",
            "/api/telemetry/latest/device-a",
            "/api/devices/positions",
        ]:
            self.assertEqual((await self.client.get(path)).status_code, 401)
        self.assertEqual(
            (
                await self.client.get(
                    "/api/telemetry/latest/device-a", headers=self.headers(self.b)
                )
            ).status_code,
            404,
        )
        for uid in ["disabled", "deleted", "unknown"]:
            self.assertEqual(
                (
                    await self.client.get(
                        "/api/telemetry/latest/" + uid, headers=self.headers(self.a)
                    )
                ).status_code,
                404,
            )
        response = await self.client.get("/api/telemetry/latest", headers=self.headers(self.a))
        self.assertEqual(list(response.json()["devices"]), ["device-a"])
        positions = await self.client.get("/api/devices/positions", headers=self.headers(self.a))
        self.assertEqual(positions.status_code, 200, positions.text)
        self.assertEqual([d["device_uid"] for d in positions.json()], ["device-a"])
        deleted = await self.client.delete("/api/devices/device-a", headers=self.headers(self.b))
        self.assertEqual(deleted.status_code, 403)
        async with self.sessions() as db:
            self.assertIsNone((await db.get(Device, 1)).deleted_at)

    async def test_websocket_rejects_cross_owner_expired_and_revoked_token(self):
        from datetime import timedelta

        from app.main import _authorize_telemetry_socket

        with patch("app.db.database.get_session_maker", return_value=self.sessions):
            self.assertTrue(await _authorize_telemetry_socket(self.a, "device-a"))
            self.assertFalse(await _authorize_telemetry_socket(self.b, "device-a"))
            self.assertFalse(await _authorize_telemetry_socket(self.a, "disabled"))
            self.assertFalse(
                await _authorize_telemetry_socket(
                    create_access_token({"sub": "invalid"}), "device-a"
                )
            )
            expired = create_access_token({"sub": "1"}, timedelta(seconds=-1))
            self.assertFalse(await _authorize_telemetry_socket(expired, "device-a"))
            logout = await self.client.post("/api/auth/logout", headers=self.headers(self.a))
            self.assertEqual(logout.status_code, 200)
            self.assertFalse(await _authorize_telemetry_socket(self.a, "device-a"))

    async def test_mqtt_rejects_spoofed_invalid_and_inactive_messages(self):
        mqtt_consumer._latest_state.clear()
        broadcast = AsyncMock()
        cases = [
            ("sensors/device-a/telemetry", {"device_id": "device-b"}),
            ("sensors/device-a/command", {"device_id": "device-a"}),
            ("sensors/disabled/telemetry", {"device_id": "disabled"}),
            ("sensors/deleted/telemetry", {"device_id": "deleted"}),
            ("sensors/unknown/telemetry", {"device_id": "unknown"}),
            ("sensors/device-a/telemetry", {"temperature": 1}),
            ("sensors/device-a/telemetry", {"device_id": "device-a", "gps": {"lat": 91}}),
            ("sensors/device-a/telemetry", {"device_id": "device-a", "temperature": float("nan")}),
        ]
        with (
            patch("app.services.mqtt_consumer.get_session_maker", return_value=self.sessions),
            patch.object(mqtt_consumer.ws_manager, "send_to_device", broadcast),
        ):
            for topic, payload in cases:
                await mqtt_consumer._handle_message(
                    SimpleNamespace(topic=topic, payload=json.dumps(payload).encode())
                )
            for payload in [b"\xff", b"not json", b"x" * 65537, b"[]"]:
                await mqtt_consumer._handle_message(
                    SimpleNamespace(topic="sensors/device-a/telemetry", payload=payload)
                )
        self.assertEqual(mqtt_consumer._latest_state, {})
        broadcast.assert_not_awaited()

    async def test_valid_mqtt_preserves_zero_and_updates_only_topic_device(self):
        mqtt_consumer._latest_state.clear()
        payload = {
            "device_id": "device-a",
            "timestamp": 0,
            "acc_z": 0,
            "source": "simulator",
            "seq": 0,
            "lat": 0,
            "lng": 0,
            "alt": 0,
        }
        with (
            patch("app.services.mqtt_consumer.get_session_maker", return_value=self.sessions),
            patch.object(mqtt_consumer.ws_manager, "send_to_device", AsyncMock()) as broadcast,
        ):
            await mqtt_consumer._handle_message(
                SimpleNamespace(
                    topic="sensors/device-a/telemetry", payload=json.dumps(payload).encode()
                )
            )
        normalized = mqtt_consumer._latest_state["device-a"]
        self.assertEqual(normalized["accZ"], 0)
        self.assertEqual(normalized["timestamp"], 0)
        self.assertEqual(normalized["seq"], 0)
        broadcast.assert_awaited_once()
        async with self.sessions() as db:
            self.assertIsNotNone((await db.get(Device, 1)).last_position_at)
            self.assertIsNone((await db.get(Device, 2)).last_position_at)

    async def test_validation_is_json_safe_and_does_not_echo_password(self):
        for components in [
            [{"id": "sensor", "type": "led"}],
            [{"id": "same", "type": "esp32-devkit"}, {"id": "same", "type": "led"}],
        ]:
            response = await self.client.post(
                "/api/simulations",
                headers=self.headers(self.a),
                json={"device_id": 1, "config": {"components": components}},
            )
            self.assertEqual(response.status_code, 422, response.text)
            self.assertEqual(response.json()["error_code"], "VALIDATION_ERROR")
        password = "sensitive-" + "x" * 100
        response = await self.client.post(
            "/api/auth/register", json={"email": "a@example.com", "password": password}
        )
        self.assertEqual(response.status_code, 422)
        self.assertNotIn(password, response.text)
        self.assertEqual(set(response.json()["details"][0]), {"type", "loc", "msg"})
        bad_json = await self.client.post(
            "/api/auth/register", content=b"\xff", headers={"Content-Type": "application/json"}
        )
        self.assertEqual(bad_json.status_code, 400)


class TelemetrySchemaTests(unittest.TestCase):
    def test_shared_serial_mqtt_examples_and_null_measurements(self):
        from pathlib import Path

        examples = json.loads(
            (Path(__file__).resolve().parents[3] / "shared/telemetry.examples.json").read_text(
                encoding="utf-8"
            )
        )
        for example in examples:
            normalized = TelemetryPayload(**example["input"]).normalized()
            TelemetryFrame.model_validate(normalized)
            for key, expected in example["expected"].items():
                self.assertEqual(normalized[key], expected, key)
        frame = TelemetryPayload(device_id="test").normalized()
        self.assertIsNone(frame["accZ"])
        self.assertIsNone(frame["voltageV"])
        self.assertIsNone(frame["timestamp"])
        self.assertGreater(frame["received_at"], 0)

    def test_sensor_strings_and_booleans_are_rejected(self):
        for value in ["1", True]:
            with self.assertRaises(ValidationError):
                TelemetryPayload(device_id="test", acc_x=value)

    def test_finite_values_and_required_identity(self):
        for payload in [
            {},
            {"device_id": "a", "gyro": {"x": float("inf")}},
            {"device_id": "a", "voltage": float("-inf")},
        ]:
            with self.assertRaises(ValidationError):
                TelemetryPayload(**payload)
