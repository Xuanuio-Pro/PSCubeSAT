"""Per-lesson quizzes (Lab 0 `quiz-0-1`): own bank, flexible draw size, pass-to-complete."""

import unittest
from copy import deepcopy
from uuid import uuid4

from sqlalchemy import select

from app.models.quiz import QuestionVersion, QuizAttemptItem
from app.services.quizzes import now
from app.tests import test_course_configuration as course
from app.tests import test_learning as learning
from app.tests.test_quizzes import question

LESSON = "quiz-0-1"


class LessonQuizTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.learning = learning.LearningAPITests()
        await self.learning.asyncSetUp()
        self.fixture = self.learning.fixture
        self.sessions, self.base = self.learning.sessions, self.learning.base
        self.bank_url = f"{self.base}/lessons/{LESSON}/question-bank"
        self.attempt_url = f"{self.base}/lessons/{LESSON}/attempts"

    async def asyncTearDown(self):
        await self.learning.asyncTearDown()

    async def call(self, user, method, url, body=None):
        return await self.fixture.call(user, method, url, body)

    async def bank(self):
        response = await self.call(2, "GET", self.bank_url)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def clear_bank(self, bank_id):
        from sqlalchemy import delete

        async with self.sessions() as db:
            await db.execute(delete(QuestionVersion).where(QuestionVersion.bank_id == bank_id))
            await db.commit()

    async def add_approved(self, bank_id, count):
        async with self.sessions() as db:
            for index in range(count):
                db.add(
                    QuestionVersion(
                        id=str(uuid4()),
                        question_id=str(uuid4()),
                        bank_id=bank_id,
                        content=question(index),
                        status="approved",
                        reviewer=2,
                        reviewed_at=now(),
                    )
                )
            await db.commit()

    async def enable_quiz(self):
        body = deepcopy(self.learning.body)
        for item in body["lessons"]:
            if item["lesson_id"] == LESSON:
                item.update(enabled=True, required=False)
        return body

    async def test_bank_is_per_lesson_and_teacher_only(self):
        bank = await self.bank()
        self.assertEqual(bank["lesson_id"], LESSON)
        self.assertEqual(bank["kind"], "quiz")
        self.assertEqual(bank["required_questions"], 1)
        lab_test = (await self.call(2, "GET", f"{self.base}/labs/0/question-bank")).json()
        self.assertEqual(lab_test["kind"], "labtest")
        self.assertEqual(lab_test["required_questions"], 1)
        self.assertNotEqual(bank["id"], lab_test["id"])
        for user in (3, 4):
            self.assertEqual((await self.call(user, "GET", self.bank_url)).status_code, 403)

    async def test_publish_needs_an_approved_question_and_enabling_needs_a_published_bank(self):
        bank = await self.bank()
        await self.clear_bank(bank["id"])
        bank = await self.bank()
        short = await self.call(
            2, "POST", self.bank_url + "/publish", {"expected_revision": bank["revision"]}
        )
        self.assertEqual(short.status_code, 409)
        self.assertEqual(short.json()["code"], "BANK_NOT_READY")
        self.assertEqual(short.json()["details"]["required"], 1)

        saved = await self.fixture.save(await self.enable_quiz())
        self.assertEqual(saved.status_code, 200, saved.text)
        blocked = await self.fixture.publish(
            course.settings_payload(saved.json())["expected_version"]
        )
        self.assertEqual(blocked.status_code, 422)
        self.assertIn("QUIZ_BANK_NOT_READY", blocked.text)

    async def test_pass_completes_the_quiz_lesson_and_answers_stay_private(self):
        bank = await self.bank()
        await self.clear_bank(bank["id"])
        await self.add_approved(bank["id"], 4)
        published = await self.call(
            2, "POST", self.bank_url + "/publish", {"expected_revision": bank["revision"]}
        )
        self.assertEqual(published.status_code, 200, published.text)
        await self.learning.apply(await self.enable_quiz())

        locked = await self.call(4, "POST", self.attempt_url, {"idempotency_key": str(uuid4())})
        self.assertEqual(locked.status_code, 403, locked.text)
        # Doc 0.1 is the only lesson before quiz-0-1; summary-0 comes after the quiz.
        await self.learning.complete_lesson("document")

        started = await self.call(4, "POST", self.attempt_url, {"idempotency_key": str(uuid4())})
        self.assertEqual(started.status_code, 200, started.text)
        attempt = started.json()
        self.assertEqual(attempt["lesson_id"], LESSON)
        # The paper holds every approved question: 4 were approved, so 4 are asked.
        self.assertEqual(len(attempt["items"]), 4)
        self.assertNotIn("correct_choice_id", started.text)
        self.assertNotIn("explanation", started.text)

        async with self.sessions() as db:
            selected = {
                item.id: item.snapshot["correct_choice_id"]
                for item in (
                    await db.execute(
                        select(QuizAttemptItem).where(QuizAttemptItem.attempt_id == attempt["id"])
                    )
                ).scalars()
            }
        saved = await self.call(
            4,
            "PUT",
            f"/api/attempts/{attempt['id']}/answers",
            {
                "idempotency_key": str(uuid4()),
                "expected_revision": attempt["answer_revision"],
                "answers": selected,
            },
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        result = await self.call(4, "POST", f"/api/attempts/{attempt['id']}/submit")
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["score"], 4)
        self.assertTrue(result.json()["passed"])

        lessons = {item["id"]: item for item in (await self.learning.path())["labs"][0]["lessons"]}
        self.assertEqual(lessons[LESSON]["status"], "completed")


class CombinedCsvImportTests(unittest.TestCase):
    """One file holds the questions, the correct answer and the explanations."""

    HEADER = (
        "prompt,choice_1_id,choice_1_text,choice_2_id,choice_2_text,choice_3_id,choice_3_text,"
        "choice_4_id,choice_4_text,correct_choice_id,explanation,explanation_a,explanation_b,"
        "explanation_c,explanation_d,objective,difficulty,source_reference" + "\n"
    )

    def test_single_csv_without_answer_file_imports_with_explanations(self):
        from types import SimpleNamespace

        from app.services.question_banks import parse_import

        row = (
            "Câu hỏi kiểm thử?,a,Một,b,Hai,c,Ba,d,Bốn,b,Giải thích chung.,Sai a.,Đúng b.,Sai c.,"
            "Sai d.,Mục tiêu,easy,Tài liệu kiểm thử" + "\n"
        )
        request = SimpleNamespace(
            format="csv", content=self.HEADER + row, answer_format=None, answer_content=None
        )
        (question,) = parse_import(request)
        self.assertEqual(question["correct_choice_id"], "b")
        self.assertEqual(question["choice_explanations"]["b"], "Đúng b.")
        self.assertEqual(question["explanation"], "Giải thích chung.")


if __name__ == "__main__":
    unittest.main()
