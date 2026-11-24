"""Verify the downloadable source catalog actually matches the pinned classroom examples."""

import json
import unittest
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from fastapi import FastAPI

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.routers import curriculum
from app.services.auth import get_current_user


class CurriculumTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # These tests cover the legacy (non-class) path; do not inherit LMS_CLASS_MODE from a local .env.
        lms_flag = patch.object(get_settings(), "lms_class_mode", False)
        lms_flag.start()
        self.addCleanup(lms_flag.stop)
        self.app = FastAPI()
        register_exception_handlers(self.app)
        self.app.include_router(curriculum.router)
        self.user = SimpleNamespace(id=1)

        async def current_user():
            return self.user

        self.app.dependency_overrides[get_current_user] = current_user
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app), base_url="http://test"
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_catalog_matches_all_32_curriculum_lessons_and_files(self):
        expected = json.loads(
            (Path(__file__).resolve().parents[3] / "tests/fixtures/practice-serial.json").read_text(
                encoding="utf-8"
            )
        )
        response = await self.client.get("/api/curriculum/exercises")
        self.assertEqual(response.status_code, 200)
        actual = response.json()["exercises"]
        # Exercises removed from the lesson list stay compilable so old drafts and links keep working.
        self.assertLessEqual({item["id"] for item in expected}, {item["id"] for item in actual})
        for item in actual:
            content = (
                (curriculum.SOURCE_DIR / item["file"]).read_text(encoding="utf-8-sig").encode()
            )
            self.assertEqual(item["source_sha256"], sha256(content).hexdigest())
            self.assertEqual(item["verified_build"]["source_sha256"], item["source_sha256"])
            self.assertEqual(item["verified_build"]["result"], "passed")
            self.assertEqual(item["board"], "esp32")
            self.assertRegex(item["upstream_commit"], "^[0-9a-f]{40}$")

    async def test_source_is_authenticated_ino_download_and_not_arbitrary_file_read(self):
        response = await self.client.get("/api/curriculum/exercises/Lab3-04_Watchdog_Timer/source")
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment;", response.headers["content-disposition"])
        self.assertIn("Lab3-04_Watchdog_Timer.ino", response.headers["content-disposition"])
        self.assertIn("esp_task_wdt_init(WDT_TIMEOUT_SEC, true)", response.text)
        self.assertIn("esp_task_wdt_reset()", response.text)
        metadata = next(
            item
            for item in curriculum.catalog()["exercises"]
            if item["id"] == "Lab3-04_Watchdog_Timer"
        )
        self.assertEqual(sha256(response.content).hexdigest(), metadata["source_sha256"])
        for exercise_id in ["missing", "catalog.json", "..%2F..%2F.env"]:
            self.assertEqual(
                (
                    await self.client.get(f"/api/curriculum/exercises/{exercise_id}/source")
                ).status_code,
                404,
            )

    async def test_guest_cannot_list_or_download_examples(self):
        self.user = None
        for url in [
            "/api/curriculum/exercises",
            "/api/curriculum/exercises/Lab1-01_Blink_LED/source",
            "/api/curriculum/legacy/labs/0/questions",
            "/api/curriculum/legacy/labs/0/quiz/quiz-0-1",
        ]:
            response = await self.client.get(url)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.headers["www-authenticate"], "Bearer")

    async def test_legacy_quiz_draw_grade_and_pilot_guard(self):
        async def never_restricted(_db, _user):
            return False

        # 1. Legacy endpoint draws 5 for quiz and 20 for labtest without leaking answers or explanations.
        with patch.object(curriculum, "legacy_restricted", side_effect=never_restricted):
            summary = await self.client.get("/api/curriculum/legacy/labs/0/questions")
            self.assertEqual(summary.status_code, 200, summary.text)
            by_id = {item["lesson_id"]: item for item in summary.json()["lessons"]}
            self.assertEqual(by_id["quiz-0-1"]["num_questions"], 5)
            self.assertEqual(by_id["quiz-0-1"]["total_pool"], 110)
            self.assertEqual(by_id["labtest-0"]["num_questions"], 20)
            self.assertEqual(by_id["labtest-0"]["total_pool"], 200)

            quiz_res = await self.client.get("/api/curriculum/legacy/labs/0/quiz/quiz-0-1")
            self.assertEqual(quiz_res.status_code, 200, quiz_res.text)
            quiz_json = quiz_res.json()
            self.assertEqual(quiz_json["num_questions"], 5)
            self.assertEqual(len(quiz_json["items"]), 5)
            self.assertEqual(quiz_json["pass_score"], 4)
            self.assertNotIn("correct_choice_id", quiz_res.text)
            self.assertNotIn("explanation", quiz_res.text)

            lt_res = await self.client.get("/api/curriculum/legacy/labs/0/quiz/labtest-0")
            self.assertEqual(lt_res.status_code, 200, lt_res.text)
            self.assertEqual(len(lt_res.json()["items"]), 20)
            self.assertEqual(lt_res.json()["pass_score"], 16)
            self.assertNotIn("correct_choice_id", lt_res.text)
            self.assertNotIn("explanation", lt_res.text)

            # 2. Server-side grading covers all 4 question types accurately and reveals explanations only after submit.
            mock_pool = [
                {
                    "question_type": "single_choice",
                    "prompt": "Câu hỏi 1 đáp án?",
                    "choices": [{"id": c, "text": f"Lựa chọn {c}"} for c in "abcd"],
                    "choice_explanations": {c: f"GT {c}" for c in "abcd"},
                    "correct_choice_id": "b",
                    "explanation": "Giải thích câu 1.",
                    "objective": "Mục tiêu",
                    "difficulty": "easy",
                    "source_reference": "Doc",
                },
                {
                    "question_type": "multiple_choice",
                    "prompt": "Câu hỏi nhiều đáp án?",
                    "choices": [{"id": c, "text": f"Ý {c}"} for c in "abcd"],
                    "choice_explanations": {},
                    "correct_choice_id": "a|c",
                    "explanation": "Giải thích câu 2.",
                    "objective": "Mục tiêu",
                    "difficulty": "medium",
                    "source_reference": "Doc",
                },
                {
                    "question_type": "true_false",
                    "prompt": "Câu hỏi Đúng/Sai?",
                    "choices": [{"id": c, "text": f"Mệnh đề {c}"} for c in "abcd"],
                    "choice_explanations": {},
                    "correct_choice_id": "a:Đ|b:S|c:Đ|d:S",
                    "explanation": "Giải thích câu 3.",
                    "objective": "Mục tiêu",
                    "difficulty": "medium",
                    "source_reference": "Doc",
                },
                {
                    "question_type": "short_answer",
                    "prompt": "Câu hỏi trả lời ngắn?",
                    "choices": [],
                    "correct_choice_id": "42.5",
                    "explanation": "Giải thích câu 4.",
                    "objective": "Mục tiêu",
                    "difficulty": "hard",
                    "source_reference": "Doc",
                },
            ]
            with patch.object(curriculum, "sample_questions_for", return_value=mock_pool):
                drawn = (
                    await self.client.get("/api/curriculum/legacy/labs/0/quiz/quiz-0-1")
                ).json()
                qids = [item["question_id"] for item in drawn["items"]]
                by_type = {item["question_type"]: item["question_id"] for item in drawn["items"]}
                graded = await self.client.post(
                    "/api/curriculum/legacy/labs/0/quiz/quiz-0-1/grade",
                    json={
                        "question_ids": qids,
                        "answers": {
                            by_type["single_choice"]: "b",
                            by_type["multiple_choice"]: "c|a",
                            by_type["true_false"]: "d:S|c:Đ|b:S|a:Đ",
                            by_type["short_answer"]: "42,5",
                        },
                    },
                )
            self.assertEqual(graded.status_code, 200, graded.text)
            g_json = graded.json()
            self.assertEqual((g_json["score"], g_json["total"], g_json["passed"]), (4, 4, True))
            self.assertTrue(
                all(item["is_correct"] and item["explanation"] for item in g_json["items"])
            )

        # 3. Pilot class students are blocked with 403 MEMBERSHIP_REQUIRED.
        async def always_restricted(_db, _user):
            return True

        with patch.object(curriculum, "legacy_restricted", side_effect=always_restricted):
            for method, path, body in (
                ("GET", "/api/curriculum/legacy/labs/0/questions", None),
                ("GET", "/api/curriculum/legacy/labs/0/quiz/quiz-0-1", None),
                (
                    "POST",
                    "/api/curriculum/legacy/labs/0/quiz/quiz-0-1/grade",
                    {"question_ids": ["deadbeef"], "answers": {}},
                ),
            ):
                blocked = await self.client.request(method, path, json=body)
                self.assertEqual(blocked.status_code, 403)
                self.assertEqual(blocked.json()["code"], "MEMBERSHIP_REQUIRED")
