"""Synthetic server-only fixtures; these are not curriculum/approved seed content."""

import json
import unittest
from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import func, select

from app.models.learning import ProgressEvent
from app.models.quiz import QuestionBank, QuestionVersion, QuizAttempt, QuizAttemptItem
from app.schemas.quiz import QuestionInput
from app.services.question_banks import validate_distinct
from app.services.quizzes import now
from app.tests import test_learning as learning


def question(index=0):
    # UUID prompts deliberately test mechanics without inventing subject-matter answers.
    return {
        "prompt": f"Fixture {uuid4()} {index}",
        "choices": [{"id": key, "text": "Lựa chọn " + key} for key in "abcd"],
        "correct_choice_id": "a",
        "explanation": "Giải thích chỉ dùng trong kiểm thử.",
        "objective": "Fixture test",
        "difficulty": "medium",
        "source_reference": "document: fixture",
    }


class QuizAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.learning = learning.LearningAPITests()
        await self.learning.asyncSetUp()
        self.fixture = self.learning.fixture
        self.sessions, self.base = self.learning.sessions, self.learning.base
        self.class_a = self.learning.class_a
        self.bank_url = self.base + "/labs/0/question-bank"
        self.attempt_url = self.base + "/labs/0/attempts"

    async def asyncTearDown(self):
        await self.learning.asyncTearDown()

    async def call(self, user, method, url, body=None):
        return await self.fixture.call(user, method, url, body)

    async def bank(self):
        response = await self.call(2, "GET", self.bank_url)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def prepare(self, count=20):
        bank = await self.bank()
        async with self.sessions() as db:
            for index in range(count):
                db.add(
                    QuestionVersion(
                        id=str(uuid4()),
                        question_id=str(uuid4()),
                        bank_id=bank["id"],
                        content=question(index),
                        status="approved",
                        reviewer=2,
                        reviewed_at=now(),
                    )
                )
            await db.commit()
        response = await self.call(
            2, "POST", self.bank_url + "/publish", {"expected_revision": bank["revision"]}
        )
        if count != 20:
            return response
        self.assertEqual(response.status_code, 200, response.text)
        body = deepcopy(self.learning.body)
        for item in body["lessons"]:
            if item["lesson_id"] == "labtest-0":
                item.update(enabled=True, required=True)
        await self.learning.apply(body)
        return response

    async def start(self, key=None):
        return await self.call(
            4, "POST", self.attempt_url, {"idempotency_key": key or str(uuid4())}
        )

    async def correct(self, attempt):
        async with self.sessions() as db:
            selected = {
                q.id: q.snapshot["correct_choice_id"]
                for q in (
                    await db.execute(
                        select(QuizAttemptItem).where(QuizAttemptItem.attempt_id == attempt["id"])
                    )
                ).scalars()
            }
        result = await self.call(
            4,
            "PUT",
            f"/api/attempts/{attempt['id']}/answers",
            {
                "idempotency_key": str(uuid4()),
                "expected_revision": attempt["answer_revision"],
                "answers": selected,
            },
        )
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    async def test_seed_empty_and_publish_requires_exact_20(self):
        async with self.sessions() as db:
            self.assertEqual(
                (await db.execute(select(func.count()).select_from(QuestionBank))).scalar_one(), 9
            )
            self.assertEqual(
                (await db.execute(select(func.count()).select_from(QuestionVersion))).scalar_one(),
                0,
            )
        for count in (0, 19, 21):
            async with self.sessions() as db:
                from sqlalchemy import delete

                await db.execute(delete(QuestionVersion))
                await db.commit()
            result = await self.prepare(count)
            self.assertEqual(result.status_code, 409)
            self.assertEqual(result.json()["code"], "BANK_NOT_READY")

    async def test_end_to_end_refresh_double_submit_and_private_answers(self):
        await self.prepare()
        self.assertEqual((await self.start()).json()["code"], "PREREQUISITE_NOT_MET")
        await self.learning.complete(0)
        key = str(uuid4())
        attempt = (await self.start(key)).json()
        self.assertEqual(len(attempt["items"]), 5)
        self.assertEqual(len({q["id"] for q in attempt["items"]}), 5)
        self.assertNotIn("correct_choice_id", json.dumps(attempt))
        self.assertNotIn("explanation", json.dumps(attempt))
        repeated = (await self.start()).json()
        self.assertEqual(repeated["id"], attempt["id"])
        self.assertEqual(repeated["items"], attempt["items"])
        refreshed = await self.call(4, "GET", f"/api/attempts/{attempt['id']}/result")
        self.assertEqual(refreshed.json()["items"], attempt["items"])
        await self.correct(attempt)
        for _ in range(2):
            result = await self.call(4, "POST", f"/api/attempts/{attempt['id']}/submit")
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["score"], 5)
            self.assertFalse(result.json()["revealed"])
        self.assertEqual((await self.start(key)).json()["id"], attempt["id"])
        path = await self.learning.path()
        self.assertEqual(path["labs"][1]["access"], "available")
        stats = await self.call(2, "GET", self.base + "/labs/0/quiz-statistics")
        self.assertEqual(stats.status_code, 200, stats.text)
        self.assertEqual(len(stats.json()), 5)
        self.assertEqual({row["correct_ratio"] for row in stats.json()}, {1})
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

    async def test_expiry_late_answers_limit_and_reveal(self):
        await self.prepare()
        await self.learning.complete(0)
        for _ in range(3):
            attempt = (await self.start()).json()
            await self.correct(attempt)
            future = now() + timedelta(minutes=11)
            with patch("app.services.quizzes.now", return_value=future):
                late = await self.call(
                    4,
                    "PUT",
                    f"/api/attempts/{attempt['id']}/answers",
                    {
                        "idempotency_key": str(uuid4()),
                        "expected_revision": 1,
                        "answers": {attempt["items"][0]["id"]: "b"},
                    },
                )
                self.assertEqual(late.json()["code"], "ATTEMPT_EXPIRED")
            result = await self.call(4, "GET", f"/api/attempts/{attempt['id']}/result")
            self.assertEqual(result.json()["status"], "expired")
            self.assertEqual(result.json()["score"], 5)
        self.assertTrue(result.json()["revealed"])
        self.assertIn("correct_choice_id", result.text)
        self.assertEqual((await self.start()).json()["code"], "ATTEMPT_LIMIT_REACHED")

    async def test_authorization_versioning_and_revision_conflicts(self):
        await self.prepare()
        await self.learning.complete(0)
        attempt = (await self.start()).json()
        for user in (3, 4):
            self.assertEqual((await self.call(user, "GET", self.bank_url)).status_code, 403)
        self.assertEqual(
            (await self.call(3, "GET", f"/api/attempts/{attempt['id']}/result")).status_code, 403
        )
        bank = await self.bank()
        rejected = await self.call(
            2,
            "POST",
            self.bank_url + "/questions",
            {"expected_revision": bank["revision"], "question": question()},
        )
        self.assertEqual(rejected.status_code, 422)
        fork = await self.call(
            2,
            "POST",
            self.bank_url + "/fork",
            {
                "expected_revision": bank["revision"],
                "reason": "Sửa câu bị sai trong phiên bản mới",
                "retire_question_id": bank["questions"][0]["question_id"],
            },
        )
        self.assertEqual(fork.status_code, 200, fork.text)
        self.assertEqual(fork.json()["version"], 2)
        refresh = await self.call(4, "GET", f"/api/attempts/{attempt['id']}/result")
        self.assertEqual(refresh.json()["items"], attempt["items"])
        await self.correct(attempt)
        conflict = await self.call(
            4,
            "PUT",
            f"/api/attempts/{attempt['id']}/answers",
            {"idempotency_key": str(uuid4()), "expected_revision": 0, "answers": {}},
        )
        self.assertEqual(conflict.json()["code"], "VERSION_CONFLICT")
        await self.call(2, "DELETE", self.base + "/members", {"user_id": 4})
        self.assertEqual(
            (await self.call(4, "GET", f"/api/attempts/{attempt['id']}/result")).status_code, 403
        )

    async def test_crud_import_review_and_ai_hidden(self):
        bank = await self.bank()
        self.assertFalse(bank["ai_available"])
        content = question()
        response = await self.call(
            2,
            "POST",
            self.bank_url + "/import",
            {
                "expected_revision": bank["revision"],
                "format": "json",
                "content": json.dumps({"questions": [content]}),
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        bank = response.json()
        row = bank["questions"][0]
        self.assertEqual(row["status"], "draft")
        response = await self.call(
            2,
            "POST",
            self.bank_url + f"/questions/{row['id']}/review",
            {"expected_revision": bank["revision"], "status": "approved"},
        )
        self.assertEqual(response.json()["questions"][0]["reviewer"], 2)
        response = await self.call(
            2,
            "PUT",
            self.bank_url + f"/questions/{row['id']}",
            {"expected_revision": response.json()["revision"], "question": content},
        )
        self.assertEqual(response.json()["questions"][0]["status"], "draft")
        duplicate = await self.call(
            2,
            "POST",
            self.bank_url + "/questions",
            {"expected_revision": response.json()["revision"], "question": content},
        )
        self.assertEqual(duplicate.status_code, 422)

    async def test_extra_attempts_reveal_close_and_highest_score(self):
        await self.prepare()
        await self.learning.complete(0)
        first = (await self.start()).json()
        await self.correct(first)
        await self.call(4, "POST", f"/api/attempts/{first['id']}/submit")
        async with self.sessions() as db:
            member_id = (await db.get(QuizAttempt, first["id"])).membership_id
        payload = {
            "membership_id": member_id,
            "extra_attempts": 1,
            "reason": "Mất mạng trong giờ kiểm thử",
            "idempotency_key": str(uuid4()),
        }
        for _ in range(2):
            response = await self.call(2, "POST", self.base + "/labs/0/attempt-grants", payload)
            self.assertEqual(response.status_code, 200, response.text)
        bank = await self.bank()
        close = now() + timedelta(minutes=20)
        policy = {k: v for k, v in bank["policy"].items() if k != "revision"}
        policy.update(
            expected_revision=bank["policy"]["revision"],
            reveal_policy="after_close",
            closes_at=close.isoformat(),
        )
        updated = await self.call(2, "PUT", self.base + "/labs/0/quiz-policy", policy)
        self.assertEqual(updated.status_code, 200, updated.text)
        second = (await self.start()).json()
        self.assertEqual(second["remaining_attempts"], 2)  # 3 default + 1 grant - 2 attempts
        result = await self.call(4, "POST", f"/api/attempts/{second['id']}/submit")
        self.assertEqual(result.json()["score"], 0)
        self.assertEqual(result.json()["highest_score"], 5)
        self.assertFalse(result.json()["revealed"])
        self.assertTrue((await self.learning.path())["labs"][0]["completed"])
        with patch("app.services.quizzes.now", return_value=close + timedelta(seconds=1)):
            result = await self.call(4, "GET", f"/api/attempts/{second['id']}/result")
            self.assertTrue(result.json()["revealed"])
        denied = await self.call(
            2,
            "POST",
            self.base + "/labs/0/attempt-grants",
            {**payload, "idempotency_key": str(uuid4())},
        )
        self.assertEqual(denied.status_code, 422)

    async def test_background_expiry_without_student_request(self):
        from app.services.question_generation import expire_attempts

        await self.prepare()
        await self.learning.complete(0)
        attempt = (await self.start()).json()
        await self.correct(attempt)
        future = now() + timedelta(minutes=11)
        with (
            patch("app.services.quizzes.now", return_value=future),
            patch("app.services.question_generation.now", return_value=future),
        ):
            await expire_attempts(self.sessions)
            await expire_attempts(self.sessions)
        async with self.sessions() as db:
            row = await db.get(QuizAttempt, attempt["id"])
            self.assertEqual((row.status, row.score), ("expired", 5))
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

    async def test_csv_atomic_validation_and_choice_ids(self):
        import csv
        import io
        from pathlib import Path

        headers = (
            (Path(__file__).resolve().parents[3] / "public/templates/question-bank.csv")
            .read_text()
            .splitlines()[0]
            .split(",")
        )
        q = question()
        row = {k: v for k, v in q.items() if k != "choices"}
        for index, choice in enumerate(q["choices"], 1):
            row[f"choice_{index}_id"], row[f"choice_{index}_text"] = choice["id"], choice["text"]
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerow(row)
        bank = await self.bank()
        response = await self.call(
            2,
            "POST",
            self.bank_url + "/import",
            {"expected_revision": bank["revision"], "format": "csv", "content": output.getvalue()},
        )
        self.assertEqual(response.status_code, 200, response.text)
        bank = response.json()
        bad = await self.call(
            2,
            "POST",
            self.bank_url + "/import",
            {
                "expected_revision": bank["revision"],
                "format": "json",
                "content": json.dumps([question(), {**question(), "correct_choice_id": "unknown"}]),
            },
        )
        self.assertEqual(bad.status_code, 422)
        self.assertEqual(len((await self.bank())["questions"]), 1)
        q["choices"][0]["id"] = "changed"
        q["correct_choice_id"] = "changed"
        changed = await self.call(
            2,
            "PUT",
            self.bank_url + "/questions/" + bank["questions"][0]["id"],
            {"expected_revision": bank["revision"], "question": q},
        )
        self.assertEqual(changed.status_code, 422)


class QuizValidationTests(unittest.TestCase):
    def test_bad_choices_answers_and_near_duplicates(self):
        value = question()
        for mutation in ({"correct_choice_id": "missing"}, {"choices": [value["choices"][0]] * 4}):
            with self.assertRaises(ValueError):
                QuestionInput.model_validate({**value, **mutation})
        with self.assertRaises(Exception):
            validate_distinct([value], [{**value, "prompt": value["prompt"] + "!"}])
