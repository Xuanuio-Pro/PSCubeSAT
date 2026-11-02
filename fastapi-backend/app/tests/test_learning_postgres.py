"""Real PostgreSQL serialization, snapshot guards and retained rollback."""

import asyncio
import json
import os
import unittest
from copy import deepcopy

from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.models.learning import LessonProgress, PracticeSubmission, ProgressEvent
from app.services.curriculum_seed import seed_curriculum
from app.tests import test_classes as classes
from app.tests import test_classes_postgres as class_pg
from app.tests import test_course_configuration as course
from app.tests import test_learning as learning
from app.tests import test_migrations as migrations


@unittest.skipUnless(
    os.getenv("PSCUBESAT_TEST_POSTGRES") == "1", "Opt-in PostgreSQL integration test"
)
class LearningPostgresTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = migrations.MigrationTests.asyncSetUp
    asyncTearDown = migrations.MigrationTests.asyncTearDown
    admin_connection = migrations.MigrationTests.admin_connection
    assert_schema_matches = migrations.MigrationTests.assert_schema_matches
    cli = class_pg.ClassPostgresTests.cli
    call = classes.ClassAPITests.call
    draft = course.CurriculumAPITests.draft
    save = course.CurriculumAPITests.save
    publish = course.CurriculumAPITests.publish
    apply = learning.LearningAPITests.apply
    event = learning.LearningAPITests.event
    path = learning.LearningAPITests.path
    complete = learning.LearningAPITests.complete

    async def setup_learning(self):
        await classes.ClassAPITests.setup_client(self)
        self.fixture = self
        self.base = f"/api/classes/{self.class_a}"
        async with self.sessions() as db:
            await seed_curriculum(db)
            await db.commit()
        await classes.ClassAPITests.add_student(self)
        self.body = course.settings_payload(await self.draft())
        for item in self.body["lessons"]:
            item["required"] = item["lesson_id"] == "document" or item["lesson_id"].startswith(
                "summary-"
            )
            if item["lesson_id"] == "document":
                item["params"] = {"markdown": "Định hướng học tập."}
        await self.apply(self.body)

    async def close_client(self):
        await self.client.aclose()
        self.redis_patch.stop()
        self.flag_patch.stop()

    async def test_concurrent_events_submissions_and_retained_rollback(self):
        await self.cli("upgrade", "head")
        await self.setup_learning()
        try:
            payload = {"idempotency_key": "parallel-read-document", "kind": "document_read"}
            responses = await asyncio.gather(
                *[
                    self.call(4, "POST", self.base + "/lessons/document/events", payload)
                    for _ in range(6)
                ]
            )
            self.assertEqual([response.status_code for response in responses], [200] * 6)
            self.assertTrue(all(response.json() == responses[0].json() for response in responses))
            async with self.sessions() as db:
                self.assertEqual(
                    (
                        await db.execute(select(func.count()).select_from(ProgressEvent))
                    ).scalar_one(),
                    1,
                )
                self.assertEqual(
                    (
                        await db.execute(select(func.count()).select_from(LessonProgress))
                    ).scalar_one(),
                    1,
                )
            body = deepcopy(self.body)
            for item in body["lessons"]:
                if item["lesson_id"] == "Lab1-01_Blink_LED":
                    item.update(
                        required=True,
                        params={
                            "instructions": "Thực hành nhấp nháy LED.",
                            "rubric": "LED nhấp nháy theo yêu cầu.",
                        },
                    )
            await self.apply(body)
            url = self.base + "/lessons/Lab1-01_Blink_LED/submissions"
            submission = {
                "idempotency_key": "parallel-submit-first",
                "code": "void setup() {} void loop() {}",
            }
            responses = await asyncio.gather(
                *[self.call(4, "POST", url, submission) for _ in range(4)]
            )
            self.assertEqual([response.status_code for response in responses], [201] * 4)
            self.assertEqual(len({response.json()["id"] for response in responses}), 1)
            latest = await self.call(
                4, "POST", url, {**submission, "idempotency_key": "second-revision-key"}
            )
            self.assertEqual(latest.json()["revision"], 2)
            review = {"verdict": "approved", "feedback": "Đáp ứng rubric."}
            old_id = responses[0].json()["id"]
            self.assertEqual(
                (
                    await self.call(2, "POST", self.base + f"/submissions/{old_id}/review", review)
                ).status_code,
                409,
            )
            new_id = latest.json()["id"]
            self.assertEqual(
                (
                    await self.call(2, "POST", self.base + f"/submissions/{new_id}/review", review)
                ).status_code,
                200,
            )
            for statement in (
                "DELETE FROM prerequisites",
                "UPDATE prerequisites SET required_lab_id=8 WHERE lab_id=1",
            ):
                async with self.engine.begin() as db:
                    nested = await db.begin_nested()
                    with self.assertRaises(DBAPIError):
                        await db.execute(text(statement))
                    await nested.rollback()
            async with self.engine.connect() as db:
                before = (
                    await db.execute(
                        text(
                            "SELECT id,membership_id,lesson_version,status FROM lesson_progress ORDER BY id"
                        )
                    )
                ).all()
            await self.cli("downgrade", "-1")
            await self.cli("upgrade", "head")
            await self.assert_schema_matches()
            async with self.engine.connect() as db:
                self.assertEqual(
                    (
                        await db.execute(
                            text(
                                "SELECT id,membership_id,lesson_version,status FROM lesson_progress ORDER BY id"
                            )
                        )
                    ).all(),
                    before,
                )
                self.assertEqual(
                    (
                        await db.execute(select(func.count()).select_from(PracticeSubmission))
                    ).scalar_one(),
                    2,
                )
            self.assertEqual((await self.path())["labs"][0]["percent"], 100)
        finally:
            await self.close_client()

    async def test_backfill_keeps_old_published_path(self):
        await self.cli("upgrade", "0007_curriculum")
        from sqlalchemy.ext.asyncio import async_sessionmaker

        sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with sessions() as db:
            await seed_curriculum(db)
            await db.commit()
        async with self.engine.begin() as db:
            await db.execute(
                text(
                    "INSERT INTO users(id,email,password_hash,role) VALUES(1,'fixture@example.com','unused','teacher')"
                )
            )
            await db.execute(
                text("INSERT INTO classes(id,code,name,created_by) VALUES(1,'OLD','Old class',1)")
            )
            await db.execute(
                text("""INSERT INTO class_course_versions(class_id,version,course_version_id,status,lab_settings)
                SELECT 1,1,id,'draft',CAST(:settings AS jsonb) FROM course_versions"""),
                {
                    "settings": json.dumps(
                        [
                            {"lab_id": 0, "prerequisites": []},
                            {"lab_id": 2, "prerequisites": [0]},
                            {"lab_id": 6, "prerequisites": [2]},
                        ]
                    )
                },
            )
            await db.execute(text("UPDATE class_course_versions SET status='published'"))
        await self.cli("upgrade", "head")
        async with self.engine.connect() as db:
            self.assertEqual(
                (
                    await db.execute(
                        text("SELECT lab_id,required_lab_id FROM prerequisites ORDER BY lab_id")
                    )
                ).all(),
                [(2, 0), (6, 2)],
            )
        await self.cli("downgrade", "-1")
        await self.cli("upgrade", "head")
