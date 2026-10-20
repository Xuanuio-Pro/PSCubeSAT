"""Opt-in real PostgreSQL tests; create and remove only isolated test databases."""
import os
import asyncio
import unittest
from pathlib import Path
from uuid import uuid4

import asyncpg
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from dotenv import dotenv_values
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.db.migrations import migration_config
from app.models.tables import Base, MQTTCredential, User, Device, LabProgress
from app.schemas.auth import RegisterRequest, LoginRequest
from app.schemas.device import CreateDeviceRequest
from app.services.auth import AuthService
from app.services.device import DeviceService
from app.services.progress import ProgressService


@unittest.skipUnless(os.getenv('PSCUBESAT_TEST_POSTGRES') == '1', 'Opt-in PostgreSQL integration test')
class MigrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.values = dotenv_values(Path(__file__).resolve().parents[2] / '.env')
        self.name = 'pscubesat_test_' + uuid4().hex
        admin = await self.admin_connection()
        try:
            await admin.execute(f'CREATE DATABASE "{self.name}" OWNER cubesat')
        finally:
            await admin.close()
        self.url = f"postgresql+asyncpg://cubesat:{self.values['POSTGRES_PASSWORD']}@127.0.0.1:5432/{self.name}"
        self.engine = create_async_engine(self.url)

    async def admin_connection(self):
        return await asyncpg.connect(host='127.0.0.1', user='postgres',
                                     password=self.values['POSTGRES_ADMIN_PASSWORD'], database='postgres')

    async def asyncTearDown(self):
        await self.engine.dispose()
        admin = await self.admin_connection()
        try:
            if not self.name.startswith('pscubesat_test_') or not self.name[15:].isalnum():
                raise RuntimeError('Unexpected test database name')
            await admin.execute(f'DROP DATABASE "{self.name}" WITH (FORCE)')
        finally:
            await admin.close()

    async def migrate(self):
        async with self.engine.begin() as conn:
            def run(sync):
                config = migration_config()
                config.attributes['connection'] = sync
                command.upgrade(config, 'head')
            await conn.run_sync(run)

    async def assert_schema_matches(self):
        async with self.engine.connect() as conn:
            def compare(sync):
                context = MigrationContext.configure(sync, opts={
                    'include_object': lambda obj, name, kind, reflected, other:
                        not (kind == 'table' and reflected and other is None and name.startswith('telemetry_')),
                    'compare_type': True,
                })
                self.assertEqual(compare_metadata(context, Base.metadata), [])
            await conn.run_sync(compare)

    async def test_fresh_install_register_login_and_device(self):
        await self.migrate()
        await self.migrate()  # Re-running the command is safe.
        await self.assert_schema_matches()
        async with async_sessionmaker(self.engine, expire_on_commit=False)() as db:
            self.assertEqual((await db.execute(select(User))).scalars().all(), [])
            user = await AuthService(db).register_user(RegisterRequest(email='fresh@example.com', password='secret123'))
            logged_in = await AuthService(db).login_user(LoginRequest(email='fresh@example.com', password='secret123'))
            self.assertEqual(logged_in.user.id, user.user.id)
            device = await DeviceService(db).register_new_device(user.user.id, CreateDeviceRequest(device_name='Fresh device'))
            credential = (await db.execute(select(MQTTCredential))).scalar_one()
            self.assertEqual(credential.username, device['mqtt_username'])
            self.assertEqual(credential.username, 'dev_' + device['device_uid'])
            self.assertIsNone(credential.deleted_at)
            # Current telemetry must land in the default partition and respect FK.
            await db.execute(text("INSERT INTO telemetry (device_id, payload) SELECT id, '{}'::jsonb FROM devices"))
            await db.commit()

    async def test_legacy_upgrade_preserves_existing_rows(self):
        raw = await asyncpg.connect(host='127.0.0.1', user='cubesat',
                                   password=self.values['POSTGRES_PASSWORD'], database=self.name)
        try:
            baseline = Path(__file__).resolve().parents[2] / 'alembic/versions/0001_baseline.sql'
            await raw.execute(baseline.read_text(encoding='utf-8'))
            await raw.execute("INSERT INTO users(email,password_hash) VALUES('legacy@example.com','preserved')")
            await raw.execute("INSERT INTO devices(user_id,device_uid,device_name,enabled,status) VALUES(1,'legacy-device','Legacy',NULL,NULL)")
            await raw.execute("INSERT INTO mqtt_credentials(device_id,username,password_hash) VALUES(1,'legacy-device','preserved')")
            await raw.execute("INSERT INTO commands(device_id,command) VALUES(1,'{}')")
            await raw.execute("INSERT INTO telemetry(device_id,payload,received_at) VALUES(1,'{}','2026-08-15')")
        finally:
            await raw.close()
        await self.migrate()
        await self.assert_schema_matches()
        async with self.engine.connect() as conn:
            self.assertEqual((await conn.execute(text('SELECT password_hash FROM users'))).scalar_one(), 'preserved')
            self.assertEqual((await conn.execute(text('SELECT count(*) FROM telemetry'))).scalar_one(), 1)
            self.assertTrue((await conn.execute(text('SELECT enabled FROM devices'))).scalar_one())
            self.assertEqual((await conn.execute(text('SELECT device_type FROM devices'))).scalar_one(), 'hardware')

    async def test_soft_delete_preserves_history_and_revokes_credentials(self):
        from app.services.simulation.manager import simulation_manager
        from app.services import mqtt_consumer
        from app.websocket.ws_manager import ws_manager
        from unittest.mock import AsyncMock
        self.addAsyncCleanup(simulation_manager.shutdown)
        await self.migrate()
        sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with sessions() as db:
            user = await AuthService(db).register_user(RegisterRequest(email='delete@example.com', password='secret123'))
            service = DeviceService(db)
            for with_history in (False, True):
                created = await service.register_new_device(user.user.id, CreateDeviceRequest(device_name='Delete me'))
                uid = created['device_uid']
                device = await service.get_device_by_uid(uid)
                device_id = device.id
                session = await simulation_manager.create(user.user.id, device_id, {}, device_uid=uid)
                await simulation_manager.start(session.session_id)
                socket = AsyncMock()
                ws_manager._connections[uid] = {socket}
                mqtt_consumer._latest_state[uid] = {'device_id': uid}
                if with_history:
                    await db.execute(text("INSERT INTO telemetry(device_id,payload) VALUES(:id,'{}')"), {'id': device_id})
                    await db.execute(text("INSERT INTO commands(device_id,command) VALUES(:id,'{}')"), {'id': device_id})
                    await db.commit()
                self.assertTrue(await service.delete_device(uid))
                self.assertNotIn(uid, mqtt_consumer._latest_state)
                self.assertNotIn(uid, ws_manager._connections)
                socket.close.assert_awaited_once_with(code=1008)
                with self.assertRaises(KeyError):
                    simulation_manager.get(session.session_id)
                self.assertFalse(await service.delete_device(uid))
                self.assertIsNone(await service.get_device_by_uid(uid))
                self.assertIsNone(await service.get_device_by_id(device_id))
                stored = await db.get(Device, device_id)
                self.assertFalse(stored.enabled)
                self.assertIsNotNone(stored.deleted_at)
                credential = (await db.execute(select(MQTTCredential).where(MQTTCredential.device_id == device_id))).scalar_one()
                self.assertFalse(credential.enabled)
                self.assertIsNotNone(credential.deleted_at)
                self.assertEqual((await db.execute(text('SELECT count(*) FROM mqtt_acl WHERE device_id=:id'), {'id': device_id})).scalar_one(), 0)
                for table in ('mqtt_credentials', 'mqtt_acl'):
                    self.assertEqual((await db.execute(text(f'SELECT count(*) FROM {table} WHERE device_id IS NULL'))).scalar_one(), 0)
                if with_history:
                    for table in ('telemetry', 'commands'):
                        self.assertEqual((await db.execute(text(f'SELECT count(*) FROM {table} WHERE device_id=:id'), {'id': device_id})).scalar_one(), 1)

    async def test_concurrent_progress_creation_and_completion(self):
        await self.migrate()
        sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with sessions() as db:
            user = await AuthService(db).register_user(RegisterRequest(email='progress@example.com', password='secret123'))
            uid = user.user.id
        async def mark(lab, action):
            async with sessions() as db:
                await getattr(ProgressService(db), action)(uid, lab)
        # Start all writers without waiting for another request to commit first.
        for lab in (0, 1):
            actions = ['mark_doc_viewed', 'mark_video_watched']
            if lab == 1:
                actions.append('mark_compiled')
            await asyncio.gather(*(mark(lab, action) for action in actions * 3))
            async with sessions() as db:
                rows = (await db.execute(select(LabProgress).where(LabProgress.user_id == uid, LabProgress.lab_id == lab))).scalars().all()
                self.assertEqual(len(rows), 1)
                self.assertTrue(rows[0].video_watched and rows[0].doc_viewed)
                self.assertIsNotNone(rows[0].completed_at)
                before = rows[0].completed_at
            await asyncio.gather(*(mark(lab, action) for action in actions))
            async with sessions() as db:
                row = (await db.execute(select(LabProgress).where(LabProgress.user_id == uid, LabProgress.lab_id == lab))).scalar_one()
                self.assertEqual(before, row.completed_at)
        async with sessions() as db:
            with self.assertRaises(ValueError):
                await ProgressService(db).mark_doc_viewed(uid, -1)
