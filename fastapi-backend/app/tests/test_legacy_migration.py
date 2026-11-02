"""Legacy rehearsal tool: read-only report, explicit pilot list, legacy kept as history."""

import unittest
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.core.security import hash_password
from app.models.learning import LessonProgress
from app.models.tables import AuditLog, ClassMembership, Classroom, LabProgress, User
from app.services import legacy_migration as tool
from app.tests import test_course_configuration as course
from app.tests.test_e2e import create_legacy_table


def spec(**changes):
    data = {
        "actor_email": "USER1@example.com",
        "teacher_email": "user2@example.com",
        "class": {"code": "pilot-1", "name": "Lớp pilot 1", "status": "active"},
        "student_emails": ["user4@example.com", "user5@example.com"],
    }
    data.update(changes)
    return tool.PilotSpec.model_validate(data)


class LegacyMigrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = course.CurriculumAPITests()
        await self.fixture.asyncSetUp()
        await create_legacy_table(self.fixture)
        self.sessions = self.fixture.sessions
        async with self.sessions() as db:
            db.add(User(id=5, email="user5@example.com", password_hash=hash_password("x1234567")))
            db.add(User(id=6, email="never-listed@example.com", password_hash="x"))
            db.add_all(
                [
                    LabProgress(id=1, user_id=4, lab_id=1, compiled_at=datetime.now(timezone.utc)),
                    LabProgress(id=2, user_id=6, lab_id=0, video_watched=True, doc_viewed=True),
                ]
            )
            await db.commit()

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown()

    async def counts(self):
        async with self.sessions() as db:
            return await tool.table_counts(db)

    async def test_report_maps_ids_and_changes_nothing(self):
        before = await self.counts()
        async with self.sessions() as db:
            report = await tool.mapping_report(db, spec())
        self.assertEqual(await self.counts(), before)
        self.assertEqual(report["lesson_ids"]["missing"], [])
        self.assertEqual(report["lesson_ids"]["mapped"], report["lesson_ids"]["legacy_total"])
        self.assertEqual(report["lab_progress"]["rows"], 2)
        self.assertEqual(report["lab_progress"]["by_lab"]["1"]["compiled"], 1)
        pilot = report["pilot"]
        self.assertEqual(pilot["errors"], [])
        by_email = {s["email"]: s for s in pilot["students"]}
        self.assertEqual(by_email["user4@example.com"]["legacy_compiled_labs"], [1])
        self.assertEqual(by_email["user5@example.com"]["action"], "add")

    async def test_invalid_list_blocks_import(self):
        bad = spec(
            teacher_email="user4@example.com",
            student_emails=["missing@example.com", "user5@example.com", "user5@example.com"],
        )
        async with self.sessions() as db:
            result = await tool.import_pilot(db, bad, apply=True)
        self.assertFalse(result["applied"])
        self.assertEqual(
            {e["code"] for e in result["errors"]},
            {"TEACHER_NOT_ACTIVE", "DUPLICATE_EMAIL", "STUDENT_INVALID"},
        )
        self.assertIsNone(
            {s["email"]: s for s in result["students"]}["missing@example.com"]["user_id"]
        )
        async with self.sessions() as db:
            self.assertIsNone(
                (
                    await db.execute(select(Classroom).where(Classroom.code == "PILOT-1"))
                ).scalar_one_or_none()
            )

    async def test_dry_run_then_apply_is_explicit_and_idempotent(self):
        before = await self.counts()
        async with self.sessions() as db:
            dry = await tool.import_pilot(db, spec())
        self.assertFalse(dry["applied"])
        self.assertEqual(await self.counts(), before)
        for _ in range(2):
            async with self.sessions() as db:
                applied = await tool.import_pilot(db, spec(), apply=True)
            self.assertTrue(applied["applied"], applied["errors"])
        async with self.sessions() as db:
            classroom = (
                await db.execute(select(Classroom).where(Classroom.code == "PILOT-1"))
            ).scalar_one()
            members = (
                await db.execute(
                    select(ClassMembership.user_id, ClassMembership.role).where(
                        ClassMembership.class_id == classroom.id
                    )
                )
            ).all()
            self.assertEqual(
                sorted((uid, role.value) for uid, role in members),
                [(2, "teacher"), (4, "student"), (5, "student")],
            )
            # Unlisted users are not enrolled; legacy history is not converted to completion.
            self.assertNotIn(6, {uid for uid, _ in members})
            self.assertEqual(
                (await db.execute(select(func.count()).select_from(LessonProgress))).scalar_one(),
                0,
            )
            self.assertEqual(
                (await db.execute(select(func.count()).select_from(LabProgress))).scalar_one(), 2
            )
            actions = set(
                (await db.execute(select(AuditLog.action).where(AuditLog.actor == 1))).scalars()
            )
            self.assertTrue({"class.create", "member.add"} <= actions)
        second = applied["students"]
        self.assertEqual({s["action"] for s in second}, {"keep"})
