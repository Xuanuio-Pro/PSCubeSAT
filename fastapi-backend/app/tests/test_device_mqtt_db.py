import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Integer, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.exceptions import register_exception_handlers
from app.core.security import verify_password
from app.db import get_db
from app.models.tables import MQTTACL, Base, Device, MQTTCredential, User
from app.routers.devices import router
from app.services.auth import get_required_user


class DeviceMqttTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.tables = [
            User.__table__,
            Device.__table__,
            MQTTCredential.__table__,
            MQTTACL.__table__,
        ]
        self.types = {t: t.c.id.type for t in self.tables}
        for t in self.tables:
            t.c.id.type = t.c.id.type.with_variant(Integer(), "sqlite")
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=self.tables))
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.sessions() as db:
            db.add(User(id=1, email="owner@example.com", password_hash="unused"))
            await db.commit()
        self.owner = 1
        app = FastAPI()
        register_exception_handlers(app)
        app.include_router(router)

        async def session():
            async with self.sessions() as db:
                yield db

        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_required_user] = lambda: SimpleNamespace(id=self.owner)
        self.client = AsyncClient(transport=ASGITransport(app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.engine.dispose()
        for table, kind in self.types.items():
            table.c.id.type = kind

    async def register(self):
        result = await self.client.post("/api/devices/register", json={"device_name": "Test board"})
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.headers["cache-control"], "no-store")
        return result.json()

    async def test_register_hash_acl_and_no_secret_in_get(self):
        item = await self.register()
        uid = item["device_uid"]
        self.assertEqual(item["mqtt_username"], "dev_" + uid)
        async with self.sessions() as db:
            cred = (await db.execute(select(MQTTCredential))).scalar_one()
            self.assertTrue(verify_password(item["device_secret"], cred.password_hash))
            self.assertNotEqual(item["device_secret"], cred.password_hash)
            rules = (await db.execute(select(MQTTACL))).scalars().all()
            self.assertEqual(
                {r.topic for r in rules},
                {
                    f"sensors/{uid}/telemetry",
                    f"sensors/{uid}/status",
                    f"sensors/{uid}/ack",
                    f"sensors/{uid}/image",
                    f"cmd/{uid}/#",
                },
            )
        result = await self.client.get(f"/api/devices/{uid}/mqtt")
        self.assertEqual(result.status_code, 200)
        self.assertNotIn("password", result.json())
        self.assertNotIn(item["device_secret"], result.text)
        details = await self.client.get(f"/api/devices/{uid}")
        self.assertNotIn(item["device_secret"], details.text)
        self.assertIn("saved-on-register-or-rotate-only", details.json()["firmware_snippet"])

    async def test_rotate_revoke_and_owner_isolation(self):
        item = await self.register()
        uid = item["device_uid"]
        self.owner = 2
        for method, path in [("get", ""), ("post", "/rotate"), ("post", "/revoke")]:
            result = await getattr(self.client, method)(f"/api/devices/{uid}/mqtt{path}")
            self.assertEqual(result.status_code, 403)
        self.owner = 1
        rotated = await self.client.post(f"/api/devices/{uid}/mqtt/rotate")
        self.assertEqual(rotated.status_code, 200, rotated.text)
        self.assertEqual(rotated.headers["cache-control"], "no-store")
        async with self.sessions() as db:
            cred = (await db.execute(select(MQTTCredential))).scalar_one()
            self.assertFalse(verify_password(item["device_secret"], cred.password_hash))
            self.assertTrue(verify_password(rotated.json()["password"], cred.password_hash))
            self.assertIsNotNone(cred.rotated_at)
        revoked = await self.client.post(f"/api/devices/{uid}/mqtt/revoke")
        self.assertFalse(revoked.json()["enabled"])
        self.assertFalse(revoked.json()["existing_sessions_disconnected"])
        again = await self.client.post(f"/api/devices/{uid}/mqtt/revoke")
        self.assertEqual(
            datetime.fromisoformat(again.json()["revoked_at"]).replace(tzinfo=timezone.utc),
            datetime.fromisoformat(revoked.json()["revoked_at"]).replace(tzinfo=timezone.utc),
        )

    async def test_db_failure_rolls_back_no_orphan_device(self):
        with patch(
            "app.repository.MQTTACL.TelemetryRepository.create",
            AsyncMock(side_effect=RuntimeError("test failure")),
        ):
            with self.assertRaises(RuntimeError):
                await self.register()
        async with self.sessions() as db:
            self.assertEqual((await db.execute(select(Device))).scalars().all(), [])
            self.assertEqual((await db.execute(select(MQTTCredential))).scalars().all(), [])

    async def test_delete_revokes_db_credentials(self):
        item = await self.register()
        result = await self.client.delete("/api/devices/" + item["device_uid"])
        self.assertEqual(result.status_code, 200, result.text)
        async with self.sessions() as db:
            cred = (await db.execute(select(MQTTCredential))).scalar_one()
            self.assertFalse(cred.enabled)
            self.assertIsNotNone(cred.revoked_at)
            self.assertEqual((await db.execute(select(MQTTACL))).scalars().all(), [])


def _settings(**overrides):
    values = {
        "mqtt_host": "broker.test",
        "mqtt_port": 8883,
        "mqtt_tls": True,
        "device_mqtt_auth": "per_device",
        "device_mqtt_username": "",
        "device_mqtt_password": "",
        "device_wifi_ssid": "PTIT-Lab",
        "device_wifi_password": "lab-pass",
    }
    return SimpleNamespace(**{**values, **overrides})


class CloudProvisionTests(DeviceMqttTests):
    """Hidden photo uplink: the board configuration the web app writes into NVS over Serial."""

    async def provision(self, settings, body=None):
        with patch("app.services.cloud_device.get_settings", return_value=settings):
            return await self.client.post("/api/devices/cloud/provision", json=body or {})

    async def test_per_device_provision_creates_one_device_and_rotates_its_secret(self):
        empty = await self.client.get("/api/devices/cloud")
        self.assertEqual(empty.status_code, 200, empty.text)
        self.assertIsNone(empty.json()["device_uid"])
        first = await self.provision(_settings())
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.headers["cache-control"], "no-store")
        config = first.json()
        uid = config["uid"]
        self.assertEqual(config["user"], f"dev_{uid}")
        self.assertEqual(config["topic"], f"sensors/{uid}/image")
        self.assertEqual((config["ssid"], config["wpass"]), ("PTIT-Lab", "lab-pass"))
        self.assertEqual((config["host"], config["port"], config["tls"]), ("broker.test", 8883, True))
        second = (await self.provision(_settings())).json()
        self.assertEqual(second["uid"], uid)
        async with self.sessions() as db:
            self.assertEqual(len((await db.execute(select(Device))).scalars().all()), 1)
            cred = (await db.execute(select(MQTTCredential))).scalar_one()
            self.assertTrue(verify_password(second["pass"], cred.password_hash))
            self.assertFalse(verify_password(config["pass"], cred.password_hash))
        with patch("app.services.cloud_device.get_settings", return_value=_settings()):
            status = (await self.client.get("/api/devices/cloud")).json()
        self.assertEqual(status["device_uid"], uid)
        self.assertNotIn("pass", status)
        # The broker (never the credential) lets the web app re-provision a board left on a retired broker.
        self.assertEqual(status["mqtt_broker"], "broker.test:8883")
        # Another account gets its own device, never this one.
        self.owner = 2
        async with self.sessions() as db:
            db.add(User(id=2, email="other@example.com", password_hash="unused"))
            await db.commit()
        other = (await self.provision(_settings())).json()
        self.assertNotEqual(other["uid"], uid)

    async def test_student_wifi_overrides_classroom_wifi(self):
        config = (await self.provision(_settings(), {"wifi_ssid": "Home", "wifi_password": "secret"})).json()
        self.assertEqual((config["ssid"], config["wpass"]), ("Home", "secret"))

    async def test_shared_broker_credentials_for_demo_brokers(self):
        settings = _settings(
            device_mqtt_auth="shared", device_mqtt_username="demo", device_mqtt_password="demo-pass"
        )
        config = (await self.provision(settings)).json()
        self.assertEqual((config["user"], config["pass"]), ("demo", "demo-pass"))
        missing = await self.provision(_settings(device_mqtt_auth="shared"))
        self.assertEqual(missing.status_code, 503)
        self.assertEqual(missing.json()["details"]["reason"], "device_mqtt_missing")

    async def test_missing_wifi_is_a_structured_error(self):
        result = await self.provision(_settings(device_wifi_ssid="", device_wifi_password=""))
        self.assertEqual(result.status_code, 409)
        self.assertEqual(result.json()["code"], "CONFIG_INVALID")
        self.assertEqual(result.json()["details"]["reason"], "wifi_missing")
        async with self.sessions() as db:
            self.assertEqual((await db.execute(select(Device))).scalars().all(), [])
