"""Cross-role flow on a clean PostgreSQL DB migrated by the Alembic CLI, plus 0010 rollback."""

import os
import unittest

from sqlalchemy import text

from app.services.curriculum_seed import seed_curriculum
from app.tests import test_classes as classes
from app.tests import test_learning_postgres as learning
from app.tests.test_e2e import cross_role_flow


@unittest.skipUnless(
    os.getenv("PSCUBESAT_TEST_POSTGRES") == "1", "Opt-in PostgreSQL integration test"
)
class E2EPostgresTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = learning.LearningPostgresTests.asyncSetUp
    asyncTearDown = learning.LearningPostgresTests.asyncTearDown
    admin_connection = learning.LearningPostgresTests.admin_connection
    assert_schema_matches = learning.LearningPostgresTests.assert_schema_matches
    cli = learning.LearningPostgresTests.cli
    call = classes.ClassAPITests.call

    async def test_cross_role_flow_and_class_mode_migration(self):
        await self.cli("upgrade", "0009_quizzes")
        async with self.engine.begin() as db:
            for statement in (
                "INSERT INTO users(id,email,password_hash,role) VALUES(99,'old@example.com','x','teacher')",
                "INSERT INTO classes(code,name,status,created_by) VALUES('OLD','Lớp cũ','active',99)",
            ):
                await db.execute(text(statement))
        # Classes created before 0010 keep their behaviour: backfilled to 'enabled'.
        await self.cli("upgrade", "head")
        async with self.engine.connect() as db:
            mode = (await db.execute(text("SELECT lms_mode FROM classes WHERE code='OLD'"))).one()
            self.assertEqual(mode, ("enabled",))
        await classes.ClassAPITests.setup_client(self)
        try:
            async with self.sessions() as db:
                await seed_curriculum(db)
                await db.commit()
            classroom = await cross_role_flow(self, self.call, self.sessions, self.tokens)
            changed = await self.call(
                1,
                "PATCH",
                f"/api/admin/classes/{classroom['id']}/lms-mode",
                {"lms_mode": "read_only", "reason": "Rollback drill"},
            )
            self.assertEqual(changed.status_code, 200, changed.text)
            async with self.engine.begin() as db:
                nested = await db.begin_nested()
                with self.assertRaises(Exception):
                    await db.execute(text("UPDATE classes SET lms_mode='paused'"))
                await nested.rollback()
            await self.cli("downgrade", "-1")
            async with self.engine.connect() as db:
                self.assertEqual(
                    (
                        await db.execute(
                            text("SELECT lms_mode FROM classes WHERE id=:id"),
                            {"id": classroom["id"]},
                        )
                    ).scalar_one(),
                    "read_only",
                )
                self.assertEqual(
                    (await db.execute(text("SELECT count(*) FROM quiz_attempts"))).scalar_one(), 1
                )
            await self.cli("upgrade", "head")
            await self.assert_schema_matches()
            report = await self.call(5, "GET", f"/api/classes/{classroom['id']}/reports")
            self.assertEqual(report.status_code, 200, report.text)
        finally:
            await learning.LearningPostgresTests.close_client(self)
