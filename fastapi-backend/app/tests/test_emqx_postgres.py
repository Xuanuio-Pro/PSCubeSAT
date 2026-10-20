"""Real PostgreSQL migration/view checks in an isolated disposable test database."""
import os
import unittest
from datetime import datetime, timezone

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import async_sessionmaker
from alembic import command

from app.tests import test_migrations as fixtures
from app.db.migrations import migration_config
from app.models.tables import User, MQTTCredential
from app.services.device import DeviceService
from app.services import device_mqtt
from app.schemas.device import CreateDeviceRequest
from app.core.security import verify_password


@unittest.skipUnless(os.getenv('PSCUBESAT_TEST_POSTGRES') == '1', 'Opt-in PostgreSQL test')
class EmqxPostgresTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.MigrationTests.asyncSetUp
    asyncTearDown = fixtures.MigrationTests.asyncTearDown
    admin_connection = fixtures.MigrationTests.admin_connection
    migrate = fixtures.MigrationTests.migrate

    async def test_migration_views_rotate_revoke_and_owner_deletion(self):
        await self.migrate()
        async with async_sessionmaker(self.engine, expire_on_commit=False)() as db:
            user = User(email='mqtt-test@example.com', password_hash='unused')
            db.add(user)
            await db.commit()
            item = await DeviceService(db).register_new_device(user.id, CreateDeviceRequest(device_name='MQTT test'))
            username, uid = item['mqtt_username'], item['device_uid']
            async def authn():
                return (await db.execute(text('SELECT * FROM emqx_mqtt_authn WHERE username=:name'), {'name': username})).mappings().all()
            async def authz():
                return (await db.execute(text('SELECT * FROM emqx_mqtt_authz WHERE username=:name ORDER BY priority DESC'), {'name': username})).mappings().all()
            rows = await authn()
            self.assertEqual(len(rows), 1)
            self.assertFalse(rows[0]['is_superuser'])
            self.assertTrue(verify_password(item['device_secret'], rows[0]['password_hash']))
            rules = await authz()
            self.assertEqual(len(rules), 5)
            self.assertEqual((rules[-1]['permission'], rules[-1]['action'], rules[-1]['topic']), ('deny', 'all', '#'))
            self.assertTrue(all(uid in r['topic'] for r in rules[:-1]))
            rotated = await device_mqtt.rotate(db, uid, user.id)
            self.assertTrue(verify_password(rotated['password'], (await authn())[0]['password_hash']))
            self.assertFalse(verify_password(item['device_secret'], (await authn())[0]['password_hash']))
            await device_mqtt.revoke(db, uid, user.id)
            self.assertEqual(await authn(), [])
            self.assertEqual(len(await authz()), 1)
            await device_mqtt.rotate(db, uid, user.id)
            user.deleted_at = datetime.now(timezone.utc)
            await db.commit()
            self.assertEqual(await authn(), [])
            self.assertEqual(len(await authz()), 1)
            # Public callers do not get hash view grants.
            public_grants = (await db.execute(text("SELECT count(*) FROM information_schema.table_privileges WHERE table_name LIKE 'emqx_mqtt_%' AND grantee='PUBLIC'"))).scalar_one()
            self.assertEqual(public_grants, 0)
        async with self.engine.begin() as conn:
            def rollback(sync):
                cfg = migration_config(); cfg.attributes['connection'] = sync
                command.downgrade(cfg, '0004_auth_email')
            await conn.run_sync(rollback)
        await self.migrate()
        async with self.engine.connect() as conn:
            self.assertEqual((await conn.execute(text('SELECT count(*) FROM mqtt_credentials'))).scalar_one(), 1)
