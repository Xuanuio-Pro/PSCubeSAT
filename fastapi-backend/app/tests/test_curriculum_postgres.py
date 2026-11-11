import os
import unittest

from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.models.curriculum import ClassCourseVersion, CourseVersion, Lesson
from app.services.curriculum_seed import seed_curriculum
from app.tests import test_classes as classes
from app.tests import test_classes_postgres as class_pg
from app.tests import test_course_configuration as course_api
from app.tests import test_migrations as fixtures


@unittest.skipUnless(
    os.getenv("PSCUBESAT_TEST_POSTGRES") == "1", "Opt-in PostgreSQL integration test"
)
class CurriculumPostgresTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.MigrationTests.asyncSetUp
    asyncTearDown = fixtures.MigrationTests.asyncTearDown
    admin_connection = fixtures.MigrationTests.admin_connection
    assert_schema_matches = fixtures.MigrationTests.assert_schema_matches
    cli = class_pg.ClassPostgresTests.cli
    call = classes.ClassAPITests.call
    draft = course_api.CurriculumAPITests.draft
    save = course_api.CurriculumAPITests.save
    publish = course_api.CurriculumAPITests.publish
    published_config = course_api.CurriculumAPITests.published_config

    async def test_fresh_cli_seed_twice_and_nondestructive_rollback(self):
        await self.cli("upgrade", "head")
        from sqlalchemy.ext.asyncio import async_sessionmaker

        sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with sessions() as db:
            first = await seed_curriculum(db)
            await db.commit()
        async with sessions() as db:
            self.assertEqual(first, await seed_curriculum(db))
            await db.commit()
            self.assertEqual(
                (await db.execute(select(func.count()).select_from(Lesson))).scalar_one(), 93
            )
        await self.cli("downgrade", "0009_quizzes")
        async with self.engine.connect() as db:
            self.assertEqual(
                (await db.execute(text("SELECT version_num FROM alembic_version"))).scalar_one(),
                "0009_quizzes",
            )
            self.assertEqual(
                (await db.execute(text("SELECT count(*) FROM lessons"))).scalar_one(), 93
            )
        await self.cli("upgrade", "head")
        await self.assert_schema_matches()
        async with sessions() as db:
            self.assertEqual(await seed_curriculum(db), first)

    async def test_database_rejects_published_edits_and_drafts_stay_isolated(self):
        await self.cli("upgrade", "head")
        await classes.ClassAPITests.setup_client(self)
        try:
            async with self.sessions() as db:
                await seed_curriculum(db)
                await db.commit()
            await classes.ClassAPITests.add_student(self)
            await self.published_config()
            statements = [
                "UPDATE course_versions SET status='draft'",
                "UPDATE labs SET title='Changed' WHERE id=2",
                "DELETE FROM lessons WHERE id='summary-2'",
                "UPDATE lessons SET content='{}' WHERE id='summary-2'",
                "UPDATE class_course_versions SET status='draft'",
                "UPDATE class_lesson_settings SET enabled=false WHERE lesson_id='summary-2'",
                "DELETE FROM class_lesson_settings WHERE lesson_id='summary-2'",
            ]
            for statement in statements:
                async with self.engine.begin() as db:
                    nested = await db.begin_nested()
                    with self.assertRaises(DBAPIError, msg=statement):
                        await db.execute(text(statement))
                    await nested.rollback()
            # Exercise actual snapshot write/publish ordering with the guards installed.
            await course_api.CurriculumAPITests.test_disabled_filtered_and_draft_isolation_dry_run(
                self
            )
            async with self.sessions() as db:
                self.assertEqual(
                    (await db.execute(select(CourseVersion.status))).scalar_one(), "published"
                )
                count = (
                    await db.execute(
                        select(func.count())
                        .select_from(ClassCourseVersion)
                        .where(ClassCourseVersion.status == "published")
                    )
                ).scalar_one()
                self.assertGreaterEqual(count, 2)
        finally:
            await self.client.aclose()
            self.redis_patch.stop()
            self.flag_patch.stop()
