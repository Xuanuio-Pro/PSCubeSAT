"""Isolated PostgreSQL migration, rollback and concurrent API verification."""

import asyncio
import os
import subprocess
import sys
import unittest
from pathlib import Path

from sqlalchemy import func, select, text

from app.models.tables import AuditLog, ClassMembership
from app.tests import test_classes as api_tests
from app.tests import test_migrations as fixtures


@unittest.skipUnless(
    os.getenv("PSCUBESAT_TEST_POSTGRES") == "1", "Opt-in PostgreSQL integration test"
)
class ClassPostgresTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.MigrationTests.asyncSetUp
    asyncTearDown = fixtures.MigrationTests.asyncTearDown
    admin_connection = fixtures.MigrationTests.admin_connection
    migrate = fixtures.MigrationTests.migrate
    assert_schema_matches = fixtures.MigrationTests.assert_schema_matches
    call = api_tests.ClassAPITests.call

    async def cli(self, *args):
        env = {**os.environ, "DATABASE_URL": self.url}
        result = await asyncio.to_thread(
            subprocess.run,
            [sys.executable, "-m", "alembic", *args],
            env=env,
            cwd=Path(__file__).resolve().parents[2],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, "Alembic command failed: " + " ".join(args))

    async def test_cli_upgrade_legacy_preservation_and_retained_downgrade(self):
        # Truly empty DB first; seed legacy data at the old head before adding LMS.
        await self.cli("upgrade", "0005_emqx_postgres")
        async with self.engine.begin() as db:
            await db.execute(
                text(
                    "INSERT INTO users(id,email,password_hash,role) VALUES(1,'legacy@example.com','preserve','user')"
                )
            )
            await db.execute(
                text(
                    "INSERT INTO lab_progress(user_id,lab_id,compiled_at,completed_at) VALUES(1,1,now(),now())"
                )
            )
            before = (await db.execute(text("SELECT * FROM lab_progress"))).mappings().one()
        await self.cli("upgrade", "head")
        await self.assert_schema_matches()
        async with self.engine.begin() as db:
            user = (
                await db.execute(
                    text("SELECT email,password_hash,role::text,status::text FROM users WHERE id=1")
                )
            ).one()
            self.assertEqual(tuple(user), ("legacy@example.com", "preserve", "user", "active"))
            self.assertEqual(
                dict((await db.execute(text("SELECT * FROM lab_progress"))).mappings().one()),
                dict(before),
            )
            await db.execute(text("UPDATE users SET role='teacher',status='locked' WHERE id=1"))
            await db.execute(
                text("INSERT INTO classes(id,code,name,created_by) VALUES(1,'KEEP','Keep',1)")
            )
            await db.execute(
                text(
                    "INSERT INTO class_memberships(class_id,user_id,role,added_by) VALUES(1,1,'teacher',1)"
                )
            )
            await db.execute(
                text(
                    "INSERT INTO audit_logs(actor,action,target,after) VALUES(1,'test','class:1',jsonb_build_object('kept',true))"
                )
            )
        await self.cli("downgrade", "-1")
        async with self.engine.connect() as db:
            self.assertEqual(
                (await db.execute(text("SELECT version_num FROM alembic_version"))).scalar_one(),
                "0009_quizzes",
            )
            self.assertEqual(
                (await db.execute(text("SELECT count(*) FROM class_memberships"))).scalar_one(), 1
            )
        await self.cli("upgrade", "head")
        await self.assert_schema_matches()
        async with self.engine.connect() as db:
            self.assertEqual(
                (await db.execute(text("SELECT status::text FROM users WHERE id=1"))).scalar_one(),
                "locked",
            )
            self.assertEqual(
                (await db.execute(text("SELECT role::text FROM users WHERE id=1"))).scalar_one(),
                "teacher",
            )
            self.assertEqual(
                (await db.execute(text("SELECT after FROM audit_logs"))).scalar_one(),
                {"kept": True},
            )

    async def test_concurrent_membership_and_audit_transaction(self):
        await self.migrate()
        await api_tests.ClassAPITests.setup_client(self)
        try:
            results = await asyncio.gather(
                *(
                    self.call(
                        2,
                        "POST",
                        f"/api/classes/{self.class_a}/members",
                        {"email": "user4@example.com"},
                    )
                    for _ in range(8)
                )
            )
            self.assertTrue(
                all(result.status_code == 200 for result in results), [r.text for r in results]
            )
            self.assertEqual(len({result.json()["id"] for result in results}), 1)
            async with self.sessions() as db:
                self.assertEqual(
                    (
                        await db.execute(
                            select(func.count())
                            .select_from(ClassMembership)
                            .where(ClassMembership.user_id == 4)
                        )
                    ).scalar_one(),
                    1,
                )
                self.assertEqual(
                    (
                        await db.execute(
                            select(func.count())
                            .select_from(AuditLog)
                            .where(AuditLog.action == "member.add")
                        )
                    ).scalar_one(),
                    1,
                )
            await api_tests.ClassAPITests.test_membership_idempotency_removal_old_token_and_restore(
                self
            )
            await api_tests.ClassAPITests.test_teacher_cannot_read_or_write_another_class(self)
            await api_tests.ClassAPITests.test_role_claim_cannot_grant_admin_and_demotion_is_immediate(
                self
            )
        finally:
            await self.client.aclose()
            self.redis_patch.stop()
            self.flag_patch.stop()

    add_student = api_tests.ClassAPITests.add_student
