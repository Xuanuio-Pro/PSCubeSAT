"""Unit and API integration tests for default sample quiz & Lab Test banks."""

import asyncio
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from sqlalchemy import create_engine, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.curriculum import (
    ClassCourseVersion,
    ClassLessonSetting,
    Course,
    CourseVersion,
    Lab,
    Lesson,
)
from app.models.quiz import QuestionBank, QuestionVersion, QuizAttemptItem, QuizPolicy
from app.models.tables import Classroom, User
from app.services.curriculum_seed import seed_curriculum
from app.services.sample_questions import default_policy, sample_questions_for
from app.tests import test_course_configuration as course
from app.tests.test_quizzes import question


class SampleQuestionLoaderTests(unittest.TestCase):
    def test_global_fallback_returns_10_for_labtest_and_rotating_3_for_quizzes(self):
        # Live CURRICULUM_DIR serves all 69 exported CubeSAT CSV pools (>= 5 per quiz, >= 200 per labtest).
        labtest_items = sample_questions_for(0, "labtest-0")
        self.assertEqual(len(labtest_items), 200)
        self.assertGreaterEqual(len(sample_questions_for(0, "quiz-0-1", quiz_index=0)), 5)
        self.assertGreaterEqual(len(sample_questions_for(0, "quiz-0-2", quiz_index=1)), 5)
        self.assertGreaterEqual(len(sample_questions_for(0, "quiz-0-3", quiz_index=2)), 5)

        # Global 10-question CSV fallback (when per-lesson/per-lab files are absent) still rotates cleanly.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            default_csv = (
                Path(__file__).resolve().parents[1]
                / "firmware/curriculum/default-question-bank.csv"
            ).read_text(encoding="utf-8")
            (root / "default-question-bank.csv").write_text(default_csv, encoding="utf-8")

            fallback_lt = sample_questions_for(0, "labtest-0", curriculum_dir=root)
            self.assertEqual(len(fallback_lt), 10)
            first_three = [
                q["prompt"]
                for q in sample_questions_for(0, "quiz-0-1", quiz_index=0, curriculum_dir=root)
            ]
            second_three = [
                q["prompt"]
                for q in sample_questions_for(0, "quiz-0-2", quiz_index=1, curriculum_dir=root)
            ]
            third_three = [
                q["prompt"]
                for q in sample_questions_for(0, "quiz-0-3", quiz_index=2, curriculum_dir=root)
            ]
            fourth_three = [
                q["prompt"]
                for q in sample_questions_for(1, "quiz-1-4", quiz_index=3, curriculum_dir=root)
            ]

            self.assertEqual(len(first_three), 3)
            self.assertEqual(len(second_three), 3)
            self.assertEqual(len(third_three), 3)
            self.assertEqual(len(fourth_three), 3)
            self.assertEqual(len(set(first_three + second_three + third_three)), 9)
            self.assertEqual(fourth_three[0], fallback_lt[9]["prompt"])
            self.assertEqual(fourth_three[1:], first_three[:2])

    def test_per_lesson_and_per_lab_overrides_and_empty_fallthrough(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            default_csv = (
                Path(__file__).resolve().parents[1]
                / "firmware/curriculum/default-question-bank.csv"
            ).read_text(encoding="utf-8")
            (root / "default-question-bank.csv").write_text(default_csv, encoding="utf-8")
            lab0 = root / "lab0"
            lab0.mkdir()
            # Empty scaffold JSON must fall through to next level.
            (lab0 / "quiz-0-1.json").write_text('{"questions": []}', encoding="utf-8")
            # Per-lab quiz override with 4 items rotates in windows of 3.
            lab_quiz = [
                {**question(i), "prompt": f"Lab0 custom quiz question {i}"} for i in range(4)
            ]
            (lab0 / "quiz.json").write_text(
                json.dumps({"questions": lab_quiz}, ensure_ascii=False), encoding="utf-8"
            )
            # Per-lesson override takes precedence over per-lab quiz.json.
            lesson_override = [
                {**question(0), "prompt": "Lesson specific override question A"},
                {**question(1), "prompt": "Lesson specific override question B"},
            ]
            (lab0 / "quiz-0-2.json").write_text(
                json.dumps({"questions": lesson_override}, ensure_ascii=False), encoding="utf-8"
            )
            # Per-lab and per-lesson overrides for labtest.
            (lab0 / "labtest.json").write_text(
                json.dumps(
                    {
                        "questions": [
                            {**question(i), "prompt": f"Lab0 labtest override {i}"}
                            for i in range(6)
                        ]
                    }
                ),
                encoding="utf-8",
            )
            (lab0 / "labtest-1.json").write_text(
                json.dumps({"questions": [{**question(0), "prompt": "Exact labtest-1 override"}]}),
                encoding="utf-8",
            )

            q01 = sample_questions_for(0, "quiz-0-1", quiz_index=0, curriculum_dir=root)
            self.assertEqual(
                [item["prompt"] for item in q01],
                [f"Lab0 custom quiz question {i}" for i in range(3)],
            )
            q02 = sample_questions_for(0, "quiz-0-2", quiz_index=1, curriculum_dir=root)
            self.assertEqual(
                [item["prompt"] for item in q02],
                ["Lesson specific override question A", "Lesson specific override question B"],
            )
            q03 = sample_questions_for(0, "quiz-0-3", quiz_index=2, curriculum_dir=root)
            # (2 * 3) % 4 == 2 -> indices 2, 3, 0
            self.assertEqual(
                [item["prompt"] for item in q03],
                [
                    "Lab0 custom quiz question 2",
                    "Lab0 custom quiz question 3",
                    "Lab0 custom quiz question 0",
                ],
            )
            lt0 = sample_questions_for(0, "labtest-0", curriculum_dir=root)
            self.assertEqual(len(lt0), 6)
            lt1 = sample_questions_for(0, "labtest-1", curriculum_dir=root)
            self.assertEqual([item["prompt"] for item in lt1], ["Exact labtest-1 override"])

    def test_default_policy_helper(self):
        self.assertEqual(
            default_policy("quiz"),
            {
                "num_questions": 5,
                "pass_score": 4,
                "time_limit_minutes": 10,
                "max_attempts": None,
                "cooldown_minutes": 0,
            },
        )
        self.assertEqual(
            default_policy("labtest"),
            {
                "num_questions": 20,
                "pass_score": 16,
                "time_limit_minutes": 20,
                "max_attempts": 5,
                "cooldown_minutes": 30,
            },
        )
        self.assertEqual(default_policy("labtest", sample_count=4)["num_questions"], 4)
        self.assertEqual(default_policy("labtest", sample_count=4)["pass_score"], 4)


class DefaultClassSampleBanksTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = course.CurriculumAPITests()
        await self.fixture.asyncSetUp()
        self.sessions = self.fixture.sessions
        self.base = f"/api/classes/{self.fixture.class_a}"

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown()

    async def call(self, user, method, path, body=None):
        return await self.fixture.call(user, method, path, body)

    async def test_new_class_defaults_concurrent_seed_and_rotating_samples(self):
        draft_res = await self.call(2, "GET", f"{self.base}/curriculum?draft=true")
        self.assertEqual(draft_res.status_code, 200, draft_res.text)
        draft = draft_res.json()
        self.assertEqual(
            [sum(1 for item in lab["lessons"] if item["enabled"]) for lab in draft["labs"]],
            [10, 31, 12, 23, 35, 15, 12, 14, 12],
        )
        lab0 = draft["labs"][0]
        lab1 = draft["labs"][1]
        self.assertEqual(sum(1 for item in lab0["lessons"] if item["enabled"]), 10)
        self.assertEqual(len(lab0["lessons"]), 10)
        self.assertEqual(sum(1 for item in lab1["lessons"] if item["enabled"]), 31)
        self.assertEqual(len(lab1["lessons"]), 31)
        video11 = next(item for item in lab1["lessons"] if item["id"] == "video-1-1")
        self.assertTrue(video11["enabled"])
        self.assertFalse(video11["required"])
        q01 = next(item for item in lab0["lessons"] if item["id"] == "quiz-0-1")
        lt0 = next(item for item in lab0["lessons"] if item["id"] == "labtest-0")
        self.assertTrue(q01["enabled"])
        self.assertTrue(q01["required"])
        self.assertEqual(
            (
                q01["content"]["time_limit_minutes"],
                q01["content"]["pass_score"],
                q01["content"]["max_attempts"],
                q01["content"]["cooldown_minutes"],
                q01["content"]["num_questions"],
            ),
            (10, 4, None, 0, 5),
        )
        self.assertTrue(lt0["enabled"])
        self.assertTrue(lt0["required"])
        self.assertEqual(
            (
                lt0["content"]["time_limit_minutes"],
                lt0["content"]["pass_score"],
                lt0["content"]["max_attempts"],
                lt0["content"]["cooldown_minutes"],
                lt0["content"]["num_questions"],
            ),
            (20, 16, 5, 30, 20),
        )

        # Concurrent bank GETs (like opening ClassCurriculumPage) seed safely with no duplicates.
        responses = await asyncio.gather(
            self.call(2, "GET", f"{self.base}/lessons/quiz-0-1/question-bank"),
            self.call(2, "GET", f"{self.base}/lessons/quiz-0-2/question-bank"),
            self.call(2, "GET", f"{self.base}/lessons/quiz-0-3/question-bank"),
            self.call(2, "GET", f"{self.base}/labs/0/question-bank"),
            self.call(2, "GET", f"{self.base}/labs/1/question-bank"),
            self.call(2, "GET", f"{self.base}/lessons/quiz-doc-2-1/question-bank"),
            self.call(2, "GET", f"{self.base}/lessons/quiz-practice-4-mux/question-bank"),
        )
        for res in responses:
            self.assertEqual(res.status_code, 200, res.text)
        b1, b2, b3, lt_bank, _, q21_bank, q4mux_bank = [res.json() for res in responses]
        expected_counts = [110, 73, 17, 141, 5]
        for bank, expected_count in zip((b1, b2, b3, q21_bank, q4mux_bank), expected_counts):
            self.assertEqual(bank["status"], "draft")
            self.assertEqual(bank["approved_count"], expected_count)
            self.assertTrue(all(q["status"] == "approved" for q in bank["questions"]))
            self.assertIsNone(bank["policy"]["max_attempts"])
            self.assertEqual(bank["policy"]["cooldown_minutes"], 0)
            self.assertEqual(bank["policy"]["num_questions"], 5)
        self.assertEqual(lt_bank["status"], "draft")
        self.assertEqual(lt_bank["approved_count"], 200)
        self.assertEqual(lt_bank["policy"]["num_questions"], 20)
        self.assertEqual(lt_bank["policy"]["max_attempts"], 5)
        self.assertEqual(lt_bank["policy"]["cooldown_minutes"], 30)

        prompts = (
            {q["prompt"] for q in b1["questions"]}
            | {q["prompt"] for q in b2["questions"]}
            | {q["prompt"] for q in b3["questions"]}
        )
        self.assertEqual(len(prompts), 200)

    async def test_brand_new_class_auto_publishes_and_student_takes_sample_quiz_and_labtest(self):
        draft = (await self.call(2, "GET", f"{self.base}/curriculum?draft=true")).json()
        body = course.settings_payload(draft)
        # Keep only document -> quiz-0-1 -> labtest-0 enabled in Lab 0 so student can test both cleanly.
        for item in body["lessons"]:
            if item["lesson_id"] == "document":
                item.update(enabled=True, required=True, params={"markdown": "Tài liệu Lab 0."})
            elif item["lesson_id"] in {"quiz-0-1", "labtest-0"}:
                item.update(enabled=True, required=True)
            elif item["lesson_id"] in {
                "overview",
                "quiz-0-2",
                "document-0-2",
                "video-0-2",
                "components",
                "quiz-0-3",
                "summary-0",
            }:
                item.update(enabled=False, required=False)

        saved = await self.fixture.save(body)
        self.assertEqual(saved.status_code, 200, saved.text)
        saved_json = saved.json()
        q01 = next(x for x in saved_json["labs"][0]["lessons"] if x["id"] == "quiz-0-1")
        self.assertFalse(q01["content"]["bank_ready"])
        self.assertTrue(q01["content"]["bank_auto_publishable"])
        self.assertEqual(q01["content"]["bank_approved_count"], 110)
        self.assertEqual(q01["content"]["bank_draft_count"], 0)

        # Dry run lists banks that will be auto-published without mutating them yet.
        dry = await self.fixture.publish(saved_json["version"], dry_run=True)
        self.assertEqual(dry.status_code, 200, dry.text)
        self.assertIn("quiz-0-1", dry.json()["auto_publish_banks"])
        self.assertIn("labtest-0", dry.json()["auto_publish_banks"])
        self.assertEqual(
            (await self.call(2, "GET", f"{self.base}/lessons/quiz-0-1/question-bank")).json()[
                "status"
            ],
            "draft",
        )

        # Real publish atomically publishes enabled quiz & labtest banks.
        pub = await self.fixture.publish(saved_json["version"], dry_run=False)
        self.assertEqual(pub.status_code, 200, pub.text)
        self.assertIn("quiz-0-1", pub.json()["auto_publish_banks"])
        self.assertIn("labtest-0", pub.json()["auto_publish_banks"])

        q01_bank = (await self.call(2, "GET", f"{self.base}/lessons/quiz-0-1/question-bank")).json()
        lt0_bank = (await self.call(2, "GET", f"{self.base}/labs/0/question-bank")).json()
        self.assertEqual(q01_bank["status"], "published")
        self.assertEqual(lt0_bank["status"], "published")

        # Student curriculum hides locked lesson content and never leaks teacher-only bank_* metadata.
        locked_curr = (
            await self.call(4, "GET", f"{self.base}/curriculum?student_view=true")
        ).json()
        locked_q01 = next(x for x in locked_curr["labs"][0]["lessons"] if x["id"] == "quiz-0-1")
        self.assertNotIn("content", locked_q01)
        for private_key in (
            "bank_status",
            "bank_approved_count",
            "bank_draft_count",
            "bank_auto_publishable",
        ):
            self.assertNotIn(private_key, json.dumps(locked_curr))

        # Complete document so quiz-0-1 unlocks.
        from datetime import datetime, timedelta, timezone

        from sqlalchemy import update

        from app.models.learning import LessonProgress

        await self.call(
            4,
            "POST",
            f"{self.base}/lessons/document/events",
            {"idempotency_key": str(uuid4()), "kind": "opened"},
        )
        async with self.sessions() as db:
            await db.execute(
                update(LessonProgress)
                .where(LessonProgress.lesson_id == "document")
                .values(started_at=datetime.now(timezone.utc) - timedelta(seconds=65))
            )
            await db.commit()
        await self.call(
            4,
            "POST",
            f"{self.base}/lessons/document/events",
            {"idempotency_key": str(uuid4()), "kind": "complete"},
        )

        # Once unlocked, student curriculum shows bank_ready=True and still hides teacher-only bank_* keys.
        student_curr = (
            await self.call(4, "GET", f"{self.base}/curriculum?student_view=true")
        ).json()
        student_q01 = next(x for x in student_curr["labs"][0]["lessons"] if x["id"] == "quiz-0-1")
        self.assertTrue(student_q01["content"]["bank_ready"])
        for private_key in (
            "bank_status",
            "bank_approved_count",
            "bank_draft_count",
            "bank_auto_publishable",
        ):
            self.assertNotIn(private_key, student_q01["content"])

        # Student starts quiz-0-1 (5 random questions from 110), answers without leaking solutions, and passes 4/5+.
        started = await self.call(
            4, "POST", f"{self.base}/lessons/quiz-0-1/attempts", {"idempotency_key": str(uuid4())}
        )
        self.assertEqual(started.status_code, 200, started.text)
        attempt = started.json()
        self.assertEqual(len(attempt["items"]), 5)
        self.assertEqual(attempt["policy"]["pass_score"], 4)
        self.assertNotIn("correct_choice_id", started.text)
        self.assertNotIn("explanation", started.text)

        async with self.sessions() as db:
            correct_map = {
                item.id: item.snapshot["correct_choice_id"]
                for item in (
                    await db.execute(
                        select(QuizAttemptItem).where(QuizAttemptItem.attempt_id == attempt["id"])
                    )
                ).scalars()
            }
        ans_res = await self.call(
            4,
            "PUT",
            f"/api/attempts/{attempt['id']}/answers",
            {
                "idempotency_key": str(uuid4()),
                "expected_revision": attempt["answer_revision"],
                "answers": correct_map,
            },
        )
        self.assertEqual(ans_res.status_code, 200, ans_res.text)
        sub_res = await self.call(4, "POST", f"/api/attempts/{attempt['id']}/submit")
        self.assertEqual(sub_res.status_code, 200, sub_res.text)
        self.assertEqual(sub_res.json()["score"], 5)
        self.assertTrue(sub_res.json()["passed"])

        # Now Lab Test 0 unlocks (20 random questions from 200, pass 16/20, 20 min).
        lt_start = await self.call(
            4, "POST", f"{self.base}/labs/0/attempts", {"idempotency_key": str(uuid4())}
        )
        self.assertEqual(lt_start.status_code, 200, lt_start.text)
        lt_attempt = lt_start.json()
        self.assertEqual(len(lt_attempt["items"]), 20)
        self.assertEqual(lt_attempt["policy"]["pass_score"], 16)
        self.assertEqual(lt_attempt["policy"]["time_limit_minutes"], 20)
        self.assertNotIn("correct_choice_id", lt_start.text)

    async def test_unapproved_draft_blocks_publish_and_load_samples_restores_without_duplicates(
        self,
    ):
        body = course.settings_payload(
            (await self.call(2, "GET", f"{self.base}/curriculum?draft=true")).json()
        )
        for item in body["lessons"]:
            if item["lesson_id"] == "document":
                item["params"] = {"markdown": "Nội dung Lab 0."}
        saved = await self.fixture.save(body)
        self.assertEqual(saved.status_code, 200, saved.text)
        version = saved.json()["version"]

        # Teacher adds a new draft question to quiz-0-1 without approving it.
        q_bank = (await self.call(2, "GET", f"{self.base}/lessons/quiz-0-1/question-bank")).json()
        added = await self.call(
            2,
            "POST",
            f"{self.base}/lessons/quiz-0-1/question-bank/questions",
            {"expected_revision": q_bank["revision"], "question": question(99)},
        )
        self.assertEqual(added.status_code, 200, added.text)
        q_bank = added.json()

        # Clear 199 sample questions in DB and delete the last one via HTTP on draft labtest-0 (no fork needed).
        from sqlalchemy import delete

        lt_bank = (await self.call(2, "GET", f"{self.base}/labs/0/question-bank")).json()
        remaining = lt_bank["questions"][0]
        drop_ids = [q["id"] for q in lt_bank["questions"][1:]]
        async with self.sessions() as db:
            await db.execute(delete(QuestionVersion).where(QuestionVersion.id.in_(drop_ids)))
            await db.commit()
        deleted = await self.call(
            2,
            "DELETE",
            f"{self.base}/labs/0/question-bank/questions/{remaining['id']}",
            {"expected_revision": lt_bank["revision"]},
        )
        self.assertEqual(deleted.status_code, 200, deleted.text)
        lt_bank = deleted.json()
        self.assertEqual(len(lt_bank["questions"]), 0)

        # Publishing class must fail cleanly with QUIZ_DRAFT_UNAPPROVED (quiz-0-1) and CONTENT_MISSING (labtest-0).
        blocked = await self.fixture.publish(version, dry_run=True)
        self.assertEqual(blocked.status_code, 422, blocked.text)
        by_lesson = {
            err.get("lesson_id"): err["code"] for err in blocked.json()["details"]["errors"]
        }
        self.assertEqual(by_lesson.get("quiz-0-1"), "QUIZ_DRAFT_UNAPPROVED")
        self.assertEqual(by_lesson.get("labtest-0"), "CONTENT_MISSING")

        # Approve the draft question in quiz-0-1.
        draft_q = next(q for q in q_bank["questions"] if q["status"] == "draft")
        approved = await self.call(
            2,
            "POST",
            f"{self.base}/lessons/quiz-0-1/question-bank/questions/{draft_q['id']}/review",
            {"expected_revision": q_bank["revision"], "status": "approved"},
        )
        self.assertEqual(approved.status_code, 200, approved.text)

        # Auth, conflict, and restore via load-samples on labtest-0.
        for user_id in (3, 4):
            forbidden = await self.call(
                user_id,
                "POST",
                f"{self.base}/labs/0/question-bank/load-samples",
                {"expected_revision": lt_bank["revision"]},
            )
            self.assertEqual(forbidden.status_code, 403)
        stale = await self.call(
            2,
            "POST",
            f"{self.base}/labs/0/question-bank/load-samples",
            {"expected_revision": lt_bank["revision"] + 5},
        )
        self.assertEqual(stale.status_code, 409)

        restored = await self.call(
            2,
            "POST",
            f"{self.base}/labs/0/question-bank/load-samples",
            {"expected_revision": lt_bank["revision"]},
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertEqual(restored.json()["added_count"], 200)
        self.assertEqual(restored.json()["approved_count"], 200)

        # Repeating load-samples does not create duplicates.
        repeat = await self.call(
            2,
            "POST",
            f"{self.base}/labs/0/question-bank/load-samples",
            {"expected_revision": restored.json()["revision"]},
        )
        self.assertEqual(repeat.status_code, 200, repeat.text)
        self.assertEqual(repeat.json()["added_count"], 0)
        self.assertEqual(repeat.json()["approved_count"], 200)

        # Now class publishes cleanly, including the 111 approved questions on quiz-0-1.
        pub = await self.fixture.publish(version, dry_run=False)
        self.assertEqual(pub.status_code, 200, pub.text)
        pub_q_bank = (
            await self.call(2, "GET", f"{self.base}/lessons/quiz-0-1/question-bank")
        ).json()
        self.assertEqual(pub_q_bank["status"], "published")
        self.assertEqual(pub_q_bank["approved_count"], 111)

        # Calling load-samples on a published bank is rejected cleanly (422).
        after_pub = await self.call(
            2,
            "POST",
            f"{self.base}/lessons/quiz-0-1/question-bank/load-samples",
            {"expected_revision": pub_q_bank["revision"]},
        )
        self.assertEqual(after_pub.status_code, 422)

    async def test_refresh_default_banks_preserves_custom_questions_and_is_idempotent(self):
        from sqlalchemy import delete

        from app.services.question_banks import refresh_default_banks_for_class
        from app.services.sample_questions import LEGACY_GENERIC_PROMPT_TEXTS

        draft = (await self.call(2, "GET", f"{self.base}/curriculum?draft=true")).json()
        body = course.settings_payload(draft)
        for item in body["lessons"]:
            if item["lesson_id"] == "document":
                item["params"] = {"markdown": "Nội dung Lab 0."}
        saved = await self.fixture.save(body)
        self.assertEqual(saved.status_code, 200, saved.text)
        pub = await self.fixture.publish(saved.json()["version"], dry_run=False)
        self.assertEqual(pub.status_code, 200, pub.text)

        # Simulate a legacy DB state: replace quiz-0-1 (published) with old CPU/RAM/IPv4 prompt + 1 custom question,
        # set quiz-0-1 & labtest-0 policies to old defaults, and set quiz-0-2 policy to a custom teacher setting.
        async with self.sessions() as db:
            q01_bank = (
                await db.execute(
                    select(QuestionBank).where(
                        QuestionBank.class_id == self.fixture.class_a,
                        QuestionBank.lesson_id == "quiz-0-1",
                        QuestionBank.status == "published",
                    )
                )
            ).scalar_one()
            old_q01_id = q01_bank.id
            await db.execute(delete(QuestionVersion).where(QuestionVersion.bank_id == old_q01_id))
            custom_q = {
                **question(500),
                "prompt": "Câu hỏi riêng do giảng viên soạn trước đợt cập nhật?",
            }
            legacy_q = {
                **question(501),
                "prompt": LEGACY_GENERIC_PROMPT_TEXTS[0],
            }
            for content in (custom_q, legacy_q):
                db.add(
                    QuestionVersion(
                        id=str(uuid4()),
                        bank_id=old_q01_id,
                        question_id=str(uuid4()),
                        content=content,
                        status="approved",
                        reviewer=2,
                    )
                )
            p_q01 = await db.get(QuizPolicy, (self.fixture.class_a, "quiz-0-1"))
            p_q01.num_questions, p_q01.pass_score, p_q01.time_limit_minutes = 3, 2, 10
            p_q02 = await db.get(QuizPolicy, (self.fixture.class_a, "quiz-0-2"))
            p_q02.num_questions, p_q02.pass_score, p_q02.time_limit_minutes = 4, 3, 12
            p_lt0 = await db.get(QuizPolicy, (self.fixture.class_a, "labtest-0"))
            p_lt0.num_questions, p_lt0.pass_score, p_lt0.time_limit_minutes = 10, 8, 15
            await db.commit()

            report = await refresh_default_banks_for_class(
                db, self.fixture.class_a, actor_id=2, commit=True
            )
            self.assertEqual(report["refreshed_banks"], 1)
            self.assertEqual(report["updated_policies"], 2)

            # Old published bank version stayed intact; a new published version+1 replaced legacy prompt cleanly.
            q01_versions = list(
                (
                    await db.execute(
                        select(QuestionBank)
                        .where(
                            QuestionBank.class_id == self.fixture.class_a,
                            QuestionBank.lesson_id == "quiz-0-1",
                        )
                        .order_by(QuestionBank.version)
                    )
                ).scalars()
            )
            self.assertEqual(len(q01_versions), 2)
            self.assertEqual(q01_versions[0].id, old_q01_id)
            self.assertEqual(q01_versions[1].status, "published")
            new_prompts = [
                row.content["prompt"]
                for row in (
                    await db.execute(
                        select(QuestionVersion).where(QuestionVersion.bank_id == q01_versions[1].id)
                    )
                ).scalars()
            ]
            self.assertEqual(len(new_prompts), 111)
            self.assertIn("Câu hỏi riêng do giảng viên soạn trước đợt cập nhật?", new_prompts)
            self.assertNotIn(LEGACY_GENERIC_PROMPT_TEXTS[0], new_prompts)

            # Uncustomized policies migrated to 5/4/10 and 20/16/20; customized policy (4/3/12) untouched.
            refreshed_q01 = await db.get(QuizPolicy, (self.fixture.class_a, "quiz-0-1"))
            refreshed_q02 = await db.get(QuizPolicy, (self.fixture.class_a, "quiz-0-2"))
            refreshed_lt0 = await db.get(QuizPolicy, (self.fixture.class_a, "labtest-0"))
            self.assertEqual(
                (
                    refreshed_q01.num_questions,
                    refreshed_q01.pass_score,
                    refreshed_q01.time_limit_minutes,
                ),
                (5, 4, 10),
            )
            self.assertEqual(refreshed_q01.bank_id, q01_versions[1].id)
            self.assertEqual(
                (
                    refreshed_q02.num_questions,
                    refreshed_q02.pass_score,
                    refreshed_q02.time_limit_minutes,
                ),
                (4, 3, 12),
            )
            self.assertEqual(
                (
                    refreshed_lt0.num_questions,
                    refreshed_lt0.pass_score,
                    refreshed_lt0.time_limit_minutes,
                ),
                (20, 16, 20),
            )

            # Re-running refresh is idempotent.
            second = await refresh_default_banks_for_class(
                db, self.fixture.class_a, actor_id=2, commit=True
            )
            self.assertEqual(second["refreshed_banks"], 0)
            self.assertEqual(second["updated_policies"], 0)

    async def test_randomized_draw_honors_policy_and_lesson_param_num_questions(self):
        draft = (await self.call(2, "GET", f"{self.base}/curriculum?draft=true")).json()
        body = course.settings_payload(draft)
        for item in body["lessons"]:
            if item["lesson_id"] == "document":
                item.update(enabled=True, required=True, params={"markdown": "Nội dung Lab 0."})
            elif item["lesson_id"] == "quiz-0-1":
                item.update(
                    enabled=True, required=True, params={"num_questions": 7, "pass_score": 5}
                )
            elif item["lesson_id"] == "overview":
                item.update(enabled=False, required=False)
        saved = await self.fixture.save(body)
        self.assertEqual(saved.status_code, 200, saved.text)
        pub = await self.fixture.publish(saved.json()["version"], dry_run=False)
        self.assertEqual(pub.status_code, 200, pub.text)

        from datetime import datetime, timedelta, timezone

        from sqlalchemy import update

        from app.models.learning import LessonProgress

        await self.call(
            4,
            "POST",
            f"{self.base}/lessons/document/events",
            {"idempotency_key": str(uuid4()), "kind": "opened"},
        )
        async with self.sessions() as db:
            await db.execute(
                update(LessonProgress)
                .where(LessonProgress.lesson_id == "document")
                .values(started_at=datetime.now(timezone.utc) - timedelta(seconds=65))
            )
            await db.commit()
        await self.call(
            4,
            "POST",
            f"{self.base}/lessons/document/events",
            {"idempotency_key": str(uuid4()), "kind": "complete"},
        )
        started = await self.call(
            4, "POST", f"{self.base}/lessons/quiz-0-1/attempts", {"idempotency_key": str(uuid4())}
        )
        self.assertEqual(started.status_code, 200, started.text)
        self.assertEqual(len(started.json()["items"]), 7)
        self.assertEqual(started.json()["policy"]["pass_score"], 5)


class Migration0021UnitTests(unittest.TestCase):
    def test_0021_backfills_only_empty_draft_banks_and_untouched_labtest_policies(self):
        import asyncio as aio

        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        from sqlalchemy.ext.asyncio import create_async_engine

        mig_path = (
            Path(__file__).resolve().parents[2]
            / "alembic"
            / "versions"
            / "0021_default_sample_quiz_banks.py"
        )
        spec = importlib.util.spec_from_file_location("mig_0021", mig_path)
        mig = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mig)

        async def seed_sqlite(async_url):
            engine = create_async_engine(async_url)
            async with engine.begin() as conn:
                await conn.run_sync(
                    lambda sync: Course.metadata.create_all(
                        sync,
                        tables=[
                            User.__table__,
                            Classroom.__table__,
                            Course.__table__,
                            CourseVersion.__table__,
                            Lab.__table__,
                            Lesson.__table__,
                            ClassCourseVersion.__table__,
                            ClassLessonSetting.__table__,
                            QuestionBank.__table__,
                            QuestionVersion.__table__,
                            QuizPolicy.__table__,
                        ],
                    )
                )
            sessions = async_sessionmaker(engine, expire_on_commit=False)
            async with sessions() as db:
                db.add(User(id=1, email="t@example.com", password_hash="x", role="teacher"))
                db.add(Classroom(id=1, code="C1", name="Class 1", created_by=1))
                db.add(Classroom(id=2, code="C2", name="Class 2", created_by=1))
                await db.flush()
                report = await seed_curriculum(db)
                cv = report["course_version_id"]
                # Class 1: untouched empty draft banks + default policies.
                db.add_all(
                    [
                        QuestionBank(
                            id="c1-q1",
                            class_id=1,
                            course_version_id=cv,
                            lab_id=0,
                            lesson_id="quiz-0-1",
                            version=1,
                            status="draft",
                            created_by=1,
                        ),
                        QuestionBank(
                            id="c1-q2",
                            class_id=1,
                            course_version_id=cv,
                            lab_id=0,
                            lesson_id="quiz-0-2",
                            version=1,
                            status="draft",
                            created_by=1,
                        ),
                        QuestionBank(
                            id="c1-lt0",
                            class_id=1,
                            course_version_id=cv,
                            lab_id=0,
                            lesson_id="labtest-0",
                            version=1,
                            status="draft",
                            created_by=1,
                        ),
                        QuizPolicy(
                            class_id=1,
                            lesson_id="quiz-0-1",
                            lab_id=0,
                            num_questions=3,
                            pass_score=2,
                            time_limit_minutes=10,
                        ),
                        QuizPolicy(
                            class_id=1,
                            lesson_id="labtest-0",
                            lab_id=0,
                            num_questions=5,
                            pass_score=4,
                            time_limit_minutes=10,
                        ),
                        # Class 2: non-empty draft bank with custom policy + published empty bank must stay untouched.
                        QuestionBank(
                            id="c2-lt0",
                            class_id=2,
                            course_version_id=cv,
                            lab_id=0,
                            lesson_id="labtest-0",
                            version=1,
                            status="draft",
                            created_by=1,
                        ),
                        QuestionBank(
                            id="c2-lt1",
                            class_id=2,
                            course_version_id=cv,
                            lab_id=1,
                            lesson_id="labtest-1",
                            version=1,
                            status="published",
                            created_by=1,
                            published_by=1,
                        ),
                        QuizPolicy(
                            class_id=2,
                            lesson_id="labtest-0",
                            lab_id=0,
                            revision=2,
                            num_questions=5,
                            pass_score=3,
                            time_limit_minutes=12,
                        ),
                    ]
                )
                await db.flush()
                db.add(
                    QuestionVersion(
                        id="existing-q",
                        bank_id="c2-lt0",
                        question_id="existing-qid",
                        content=question(1),
                        status="draft",
                    )
                )
                await db.commit()
            await engine.dispose()

        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "test0021.db"
            aio.run(seed_sqlite(f"sqlite+aiosqlite:///{db_path}"))

            sync_engine = create_engine(f"sqlite:///{db_path}")
            try:
                with sync_engine.begin() as conn:
                    ctx = MigrationContext.configure(conn)
                    with Operations.context(ctx):
                        mig.upgrade()
                        # Idempotent second pass must insert nothing new.
                        mig.upgrade()

                with sync_engine.connect() as conn:
                    c1_q1 = conn.execute(
                        text("SELECT status, reviewer FROM question_versions WHERE bank_id='c1-q1'")
                    ).all()
                    c1_q2 = conn.execute(
                        text("SELECT status FROM question_versions WHERE bank_id='c1-q2'")
                    ).all()
                    c1_lt0 = conn.execute(
                        text("SELECT status FROM question_versions WHERE bank_id='c1-lt0'")
                    ).all()
                    c2_lt0 = conn.execute(
                        text("SELECT id FROM question_versions WHERE bank_id='c2-lt0'")
                    ).all()
                    c2_lt1 = conn.execute(
                        text("SELECT id FROM question_versions WHERE bank_id='c2-lt1'")
                    ).all()
                    p1 = conn.execute(
                        text(
                            "SELECT num_questions, pass_score, time_limit_minutes FROM quiz_policies WHERE class_id=1 AND lesson_id='labtest-0'"
                        )
                    ).one()
                    p2 = conn.execute(
                        text(
                            "SELECT num_questions, pass_score, time_limit_minutes FROM quiz_policies WHERE class_id=2 AND lesson_id='labtest-0'"
                        )
                    ).one()

                self.assertEqual(c1_q1, [("approved", 1)] * 110)
                self.assertEqual(c1_q2, [("approved",)] * 73)
                self.assertEqual(c1_lt0, [("approved",)] * 200)
                self.assertEqual(c2_lt0, [("existing-q",)])
                self.assertEqual(c2_lt1, [])
                self.assertEqual(tuple(p1), (20, 16, 20))
                self.assertEqual(tuple(p2), (5, 3, 12))

                with sync_engine.begin() as conn:
                    ctx = MigrationContext.configure(conn)
                    with Operations.context(ctx):
                        mig.downgrade()
                with sync_engine.connect() as conn:
                    self.assertEqual(
                        conn.execute(
                            text("SELECT count(*) FROM question_versions WHERE bank_id='c1-lt0'")
                        ).scalar_one(),
                        200,
                    )
                    self.assertEqual(
                        tuple(
                            conn.execute(
                                text(
                                    "SELECT num_questions, pass_score, time_limit_minutes FROM quiz_policies WHERE class_id=1 AND lesson_id='labtest-0'"
                                )
                            ).one()
                        ),
                        (5, 4, 10),
                    )
                    self.assertEqual(
                        tuple(
                            conn.execute(
                                text(
                                    "SELECT num_questions, pass_score, time_limit_minutes FROM quiz_policies WHERE class_id=2 AND lesson_id='labtest-0'"
                                )
                            ).one()
                        ),
                        (5, 3, 12),
                    )

                with sync_engine.begin() as conn:
                    ctx = MigrationContext.configure(conn)
                    with Operations.context(ctx):
                        mig.upgrade()
                with sync_engine.connect() as conn:
                    self.assertEqual(
                        conn.execute(
                            text("SELECT count(*) FROM question_versions WHERE bank_id='c1-lt0'")
                        ).scalar_one(),
                        200,
                    )
                    self.assertEqual(
                        tuple(
                            conn.execute(
                                text(
                                    "SELECT num_questions, pass_score, time_limit_minutes FROM quiz_policies WHERE class_id=1 AND lesson_id='labtest-0'"
                                )
                            ).one()
                        ),
                        (20, 16, 20),
                    )
                    self.assertEqual(
                        tuple(
                            conn.execute(
                                text(
                                    "SELECT num_questions, pass_score, time_limit_minutes FROM quiz_policies WHERE class_id=2 AND lesson_id='labtest-0'"
                                )
                            ).one()
                        ),
                        (5, 3, 12),
                    )
            finally:
                sync_engine.dispose()
