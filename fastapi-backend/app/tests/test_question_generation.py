import json
import os
import unittest
from unittest.mock import patch

from sqlalchemy import select

from app.models.quiz import QuestionGenerationJob, QuestionVersion
from app.services.question_generation import run_job
from app.tests import test_quizzes as fixtures

ENV = {
    "QUIZ_AI_PROVIDER": "openai_compatible",
    "QUIZ_AI_KEY": "test-only-no-real-key",
    "QUIZ_AI_MODEL": "fixture",
    "QUIZ_AI_ENDPOINT": "https://example.invalid/chat/completions",
    "QUIZ_AI_MAX_CALL_USD": "0.10",
    "QUIZ_AI_DAILY_USD": "0.30",
}


class FakeGenerator:
    def __init__(self, fail=False):
        self.received = None
        self.fail = fail

    async def generate(self, sources, count):
        self.received = sources
        if self.fail:
            raise RuntimeError("private provider payload must never appear in API")
        return [fixtures.question(i) for i in range(count)]


class GenerationTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixtures.QuizAPITests.asyncSetUp
    asyncTearDown = fixtures.QuizAPITests.asyncTearDown
    call = fixtures.QuizAPITests.call
    bank = fixtures.QuizAPITests.bank

    async def enqueue(self, **fields):
        bank = await self.bank()
        return await self.call(
            2,
            "POST",
            self.bank_url + "/generation-jobs",
            {
                "expected_revision": bank["revision"],
                "lesson_ids": ["document"],
                "count": 2,
                **fields,
            },
        )

    async def test_selected_documents_only_draft_and_hidden_without_config(self):
        with patch.dict(os.environ, {key: "" for key in ENV}):
            self.assertFalse((await self.bank())["ai_available"])
            self.assertEqual((await self.enqueue()).status_code, 422)
        with patch.dict(os.environ, ENV):
            self.assertEqual((await self.enqueue(lesson_ids=["summary-1"])).status_code, 422)
            job = await self.enqueue()
            self.assertEqual(job.status_code, 200, job.text)
            provider = FakeGenerator()
            self.assertTrue(await run_job(self.sessions, provider))
            self.assertEqual(len(provider.received), 1)
            self.assertEqual(set(provider.received[0]), {"lesson_id", "text"})
            self.assertEqual(provider.received[0]["lesson_id"], "document")
            self.assertNotIn("email", json.dumps(provider.received))
            bank = await self.bank()
            self.assertEqual([q["status"] for q in bank["questions"]], ["draft", "draft"])
            self.assertEqual(bank["approved_count"], 0)
            jobs = (await self.call(2, "GET", self.bank_url + "/generation-jobs")).json()
            self.assertEqual(jobs[0]["status"], "succeeded")
            self.assertFalse(await run_job(self.sessions, provider))

    async def test_retry_budget_and_no_partial_questions(self):
        with patch.dict(os.environ, ENV):
            job = (await self.enqueue()).json()
            for iteration in range(3):
                await run_job(self.sessions, FakeGenerator(fail=True))
                jobs = (await self.call(2, "GET", self.bank_url + "/generation-jobs")).json()
                self.assertEqual(jobs[0]["status"], "failed")
                self.assertNotIn("private provider payload", json.dumps(jobs))
                retry = await self.call(
                    2, "POST", self.bank_url + f"/generation-jobs/{job['id']}/retry"
                )
                self.assertEqual(retry.status_code, 200 if iteration < 2 else 422, retry.text)
            self.assertEqual((await self.enqueue()).status_code, 422)
            async with self.sessions() as db:
                self.assertEqual(list((await db.execute(select(QuestionVersion))).scalars()), [])
                row = await db.get(QuestionGenerationJob, job["id"])
                self.assertEqual(row.tries, 3)
                self.assertEqual(row.reserved_microusd, 300000)

    async def test_bank_changed_during_generation_does_not_overwrite(self):
        with patch.dict(os.environ, ENV):
            await self.enqueue()
            bank = await self.bank()
            await self.call(
                2,
                "POST",
                self.bank_url + "/questions",
                {"expected_revision": bank["revision"], "question": fixtures.question()},
            )
            await run_job(self.sessions, FakeGenerator())
            self.assertEqual(len((await self.bank())["questions"]), 1)
            jobs = (await self.call(2, "GET", self.bank_url + "/generation-jobs")).json()
            self.assertEqual(jobs[0]["status"], "failed")
