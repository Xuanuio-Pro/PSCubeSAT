"""Race tests use real row locks, partial indexes and a clean isolated PostgreSQL DB."""

import asyncio
import os
import unittest
from copy import deepcopy
from uuid import uuid4

from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.models.learning import ProgressEvent
from app.models.quiz import QuizAttempt, QuizAttemptItem
from app.tests import test_learning_postgres as learning
from app.tests import test_quizzes as quizzes


@unittest.skipUnless(
    os.getenv("PSCUBESAT_TEST_POSTGRES") == "1", "Opt-in PostgreSQL integration test"
)
class QuizPostgresTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = learning.LearningPostgresTests.asyncSetUp
    asyncTearDown = learning.LearningPostgresTests.asyncTearDown
    admin_connection = learning.LearningPostgresTests.admin_connection
    assert_schema_matches = learning.LearningPostgresTests.assert_schema_matches
    cli = learning.LearningPostgresTests.cli
    call = learning.LearningPostgresTests.call
    draft = learning.LearningPostgresTests.draft
    save = learning.LearningPostgresTests.save
    publish = learning.LearningPostgresTests.publish
    apply = learning.LearningPostgresTests.apply
    event = learning.LearningPostgresTests.event
    path = learning.LearningPostgresTests.path
    complete = learning.LearningPostgresTests.complete
    bank = quizzes.QuizAPITests.bank
    prepare = quizzes.QuizAPITests.prepare
    start = quizzes.QuizAPITests.start
    correct = quizzes.QuizAPITests.correct

    async def test_races_snapshot_guards_and_rollback(self):
        await self.cli("upgrade", "head")
        await learning.LearningPostgresTests.setup_learning(self)
        self.learning = self
        self.bank_url = self.base + "/labs/0/question-bank"
        self.attempt_url = self.base + "/labs/0/attempts"
        # Exercise the production autoflush=False behavior too.
        self.sessions.configure(autoflush=False)
        try:
            await self.prepare()
            await self.complete(0)
            # Independent tabs and duplicate click keys must all receive the same attempt.
            keys = [str(uuid4()) for _ in range(3)]
            responses = await asyncio.gather(*[self.start(key) for key in keys * 2])
            self.assertEqual(
                [r.status_code for r in responses], [200] * 6, [r.text for r in responses]
            )
            self.assertEqual(len({r.json()["id"] for r in responses}), 1)
            attempt = responses[0].json()
            self.assertTrue(all(r.json()["items"] == attempt["items"] for r in responses))
            async with self.sessions() as db:
                row = await db.get(QuizAttempt, attempt["id"])
                duplicate = {
                    c.name: deepcopy(getattr(row, c.name)) for c in QuizAttempt.__table__.columns
                }
                duplicate.update(id=str(uuid4()), number=2)
                db.add(QuizAttempt(**duplicate))
                with self.assertRaises(IntegrityError):
                    await db.commit()
                await db.rollback()
            save_url = f"/api/attempts/{attempt['id']}/answers"
            item = attempt["items"][0]
            payloads = [
                {
                    "idempotency_key": str(uuid4()),
                    "expected_revision": 0,
                    "answers": {item["id"]: c["id"]},
                }
                for c in item["choices"][:2]
            ]
            saved = await asyncio.gather(*[self.call(4, "PUT", save_url, p) for p in payloads])
            self.assertEqual(sorted(r.status_code for r in saved), [200, 409])
            attempt = next(r.json() for r in saved if r.status_code == 200)
            await self.correct(attempt)
            submit_url = f"/api/attempts/{attempt['id']}/submit"
            submitted = await asyncio.gather(*[self.call(4, "POST", submit_url) for _ in range(6)])
            self.assertEqual([r.status_code for r in submitted], [200] * 6)
            self.assertEqual({r.json()["score"] for r in submitted}, {5})
            self.assertEqual((await self.path())["labs"][1]["access"], "available")
            async with self.sessions() as db:
                self.assertEqual(
                    (
                        await db.execute(
                            select(func.count())
                            .select_from(ProgressEvent)
                            .where(ProgressEvent.kind == "labtest_graded")
                        )
                    ).scalar_one(),
                    1,
                )
                item_count = (
                    await db.execute(select(func.count()).select_from(QuizAttemptItem))
                ).scalar_one()
                self.assertEqual(item_count, 5)
            # A retry of any tab's original start must still return the old final attempt.
            for key in keys:
                self.assertEqual((await self.start(key)).json()["id"], attempt["id"])
            for statement in (
                "UPDATE question_versions SET content='{}'::jsonb",
                "DELETE FROM question_versions",
                "UPDATE question_banks SET status='draft' WHERE status='published'",
                "UPDATE quiz_attempt_items SET snapshot='{}'::jsonb",
                "UPDATE quiz_attempts SET policy='{}'::jsonb",
                "UPDATE quiz_attempts SET score=0",
                "UPDATE quiz_answers SET choice_id='b'",
            ):
                async with self.engine.begin() as db:
                    nested = await db.begin_nested()
                    with self.assertRaises(DBAPIError):
                        await db.execute(text(statement))
                    await nested.rollback()
            await self.cli("downgrade", "-1")
            async with self.engine.connect() as db:
                self.assertEqual(
                    (
                        await db.execute(text("SELECT count(*) FROM quiz_attempt_items"))
                    ).scalar_one(),
                    5,
                )
                self.assertEqual(
                    (await db.execute(text("SELECT score FROM quiz_attempts"))).scalar_one(), 5
                )
            await self.cli("upgrade", "head")
            await self.assert_schema_matches()
        finally:
            await learning.LearningPostgresTests.close_client(self)
