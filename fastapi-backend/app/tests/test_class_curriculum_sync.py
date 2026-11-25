"""Curriculum sync, 100% enabled defaults, and Lab 1 37-lesson standardization tests."""

import json
import os
import unittest
from pathlib import Path
from uuid import uuid4

from sqlalchemy import func, select

from app.models.curriculum import (
    ClassCourseVersion,
    ClassLessonSetting,
    Course,
    CourseVersion,
    Lab,
    Lesson,
)
from app.models.learning import (
    CompletionOverride,
    LessonProgress,
    PracticeSubmission,
    Prerequisite,
)
from app.models.quiz import (
    QuestionBank,
    QuestionVersion,
    QuizAttempt,
    QuizAttemptItem,
    QuizPolicy,
)
from app.models.tables import ClassMembership
from app.services.course_configuration import (
    sync_classes_to_latest_course,
    upgrade_class_to_course_version,
)
from app.services.curriculum_seed import read_seed, seed_curriculum
from app.services.quizzes import now
from app.tests import test_classes as classes
from app.tests import test_classes_postgres as class_pg
from app.tests import test_course_configuration as course
from app.tests import test_migrations as migrations
from app.tests.test_quizzes import question

SEED_PATH = Path(__file__).resolve().parents[1] / "firmware" / "curriculum" / "seed.json"


async def _seed_legacy_course_version(db, *, cv_id: str, version_num: int):
    """Create an older CourseVersion (14 lessons in Lab 1 with old IDs, 10 in Lab 0)."""
    seed = read_seed()
    if not await db.get(Course, seed["course_id"]):
        db.add(Course(id=seed["course_id"], title=seed["course_title"]))
        await db.flush()
    cv = CourseVersion(
        id=cv_id,
        course_id=seed["course_id"],
        version=version_num,
        status="draft",
        source_hash="legacy-" + cv_id,
    )
    db.add(cv)
    await db.flush()
    for lab_data in seed["labs"]:
        db.add(
            Lab(
                course_version_id=cv_id,
                **{k: v for k, v in lab_data.items() if k != "lessons"},
            )
        )
    await db.flush()
    legacy_id_map = {
        "Lab1-04_Button": "Lab1-03_Button",
        "Lab1-05_LED_Button": "Lab1-04_LED_Button",
        "Lab1-06_7_Segment_LED": "Lab1-05_7_Segment_LED",
        "Lab1-07_Serial_Communication": "Lab1-06_Serial_Communication",
        "Lab1-08_Serial_Control_LED": "Lab1-07_Serial_Control_LED",
        "Lab1-09_WiFi_Connection": "Lab1-08_WiFi_Connection",
        "Lab1-10_WiFi_AP_Mode": "Lab1-09_WiFi_AP_Mode",
        "Lab1-11_Web_Server_LED": "Lab1-10_Web_Server_LED",
    }
    for lab_data in seed["labs"]:
        src_lessons = lab_data["lessons"]
        if lab_data["id"] == 1:
            chosen_ids = {
                "document-1-1",
                "document-1-2",
                "Lab1-01_Blink_LED",
                "Lab1-02_Control_Multiple_LEDs",
                "Lab1-04_Button",
                "Lab1-05_LED_Button",
                "Lab1-06_7_Segment_LED",
                "Lab1-07_Serial_Communication",
                "Lab1-08_Serial_Control_LED",
                "Lab1-10_WiFi_AP_Mode",
                "Lab1-11_Web_Server_LED",
                "video-1-1",
                "summary-1",
                "labtest-1",
            }
            expanded = []
            for item in src_lessons:
                if item["type"] == "practice" and item.get("content", {}).get("exercises"):
                    for ex in item["content"]["exercises"]:
                        expanded.append(
                            {
                                **item,
                                "id": ex["id"],
                                "title": ex["title"],
                                "content": {
                                    **{
                                        k: v for k, v in item["content"].items() if k != "exercises"
                                    },
                                    "exercise_id": ex["id"],
                                    "repository_url": ex.get("repository_url", ""),
                                },
                            }
                        )
                else:
                    expanded.append(item)
            src_lessons = [
                {**item, "id": legacy_id_map.get(item["id"], item["id"])}
                for item in expanded
                if item["id"] in chosen_ids
            ]
            assert len(src_lessons) == 14, len(src_lessons)
        elif lab_data["id"] >= 2:
            # Older Lab 2-8 snapshots omitted self-review quiz checkpoints.
            src_lessons = [item for item in src_lessons if item["type"] != "quiz"]
        for order_no, item in enumerate(src_lessons):
            db.add(
                Lesson(
                    course_version_id=cv_id,
                    order_no=order_no,
                    **{
                        k: v
                        for k, v in item.items()
                        if not k.startswith("default_") and k != "order_no"
                    },
                )
            )
    await db.flush()
    cv.status = "published"
    await db.flush()


class Lab1SyllabusAndSyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = course.CurriculumAPITests()
        await self.fixture.asyncSetUp()
        self.sessions = self.fixture.sessions
        self.class_a = self.fixture.class_a
        self.class_b = self.fixture.class_b

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown()

    async def call(self, user, method, path, body=None):
        return await self.fixture.call(user, method, path, body)

    def test_lab1_seed_has_31_lessons_grouped_practices_and_all_sub_exercises(self):
        data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        self.assertEqual(
            [len(lab["lessons"]) for lab in data["labs"]],
            [10, 31, 12, 23, 35, 15, 12, 14, 12],
        )
        lab1 = next(lab for lab in data["labs"] if lab["id"] == 1)
        self.assertTrue(
            lab1["objectives"].startswith(
                "Làm chủ vi điều khiển ESP32-WROOM-32, môi trường Web IDE đám mây"
            )
        )
        expected_ids = [
            "video-1-1",
            "document-1-1",
            "quiz-1-1",
            "video-1-2",
            "document-1-2",
            "quiz-1-2",
            "doc-1-3",
            "quiz-1-3",
            "practice-1-led",
            "quiz-1-4",
            "doc-1-4",
            "quiz-1-5",
            "practice-1-button",
            "quiz-1-6",
            "doc-1-5",
            "quiz-1-7",
            "Lab1-06_7_Segment_LED",
            "quiz-1-8",
            "doc-1-6",
            "quiz-1-9",
            "practice-1-uart",
            "quiz-1-10",
            "doc-1-7",
            "quiz-1-11",
            "doc-1-8",
            "quiz-1-12",
            "video-1-5",
            "practice-1-wifi",
            "quiz-1-13",
            "summary-1",
            "labtest-1",
        ]
        lessons = lab1["lessons"]
        self.assertEqual([item["id"] for item in lessons], expected_ids)
        by_id = {item["id"]: item for item in lessons}
        # Grouped practices retain ordered child exercises while preserving upstream GitHub URLs.
        self.assertEqual(
            [ex["id"] for ex in by_id["practice-1-led"]["content"]["exercises"]],
            ["Lab1-01_Blink_LED", "Lab1-02_Control_Multiple_LEDs", "Lab1-03_PWM_LED"],
        )
        btn_ex = by_id["practice-1-button"]["content"]["exercises"][0]
        self.assertEqual(btn_ex["id"], "Lab1-04_Button")
        self.assertEqual(btn_ex["repository_url"], "https://github.com/PTITCube/Lab1-03_Button")
        self.assertEqual(
            by_id["Lab1-06_7_Segment_LED"]["title"], "Thực hành Component 74HC595 & LED 7 Đoạn"
        )
        self.assertEqual(
            by_id["Lab1-06_7_Segment_LED"]["content"]["exercise_id"], "Lab1-06_7_Segment_LED"
        )
        self.assertIn("Xtensa LX6", by_id["quiz-1-1"]["content"]["description"])
        self.assertEqual(by_id["labtest-1"]["title"], "Câu hỏi kiểm tra Thực hành lab-test")
        self.assertEqual(by_id["labtest-1"]["content"]["description"], "Trắc nghiệm tổng hợp lab1")
        lab4_ids = [item["id"] for item in data["labs"][4]["lessons"]]
        self.assertLess(
            lab4_ids.index("Lab4-05_Camera_Multiplexer"),
            lab4_ids.index("Lab4-06_Read_All_Sensors"),
        )

    async def test_upgrade_and_sync_aligns_classes_preserving_banks_and_progress(self):
        latest_cv_id = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()["course_version_id"]
        legacy_cv_id = "cubesat-legacy-v0"

        # Enroll student (4) in class_b as well so both classes are tested.
        added = await self.call(
            3,
            "POST",
            f"/api/classes/{self.class_b}/members",
            {"email": "user4@example.com"},
        )
        self.assertIn(added.status_code, (200, 201), added.text)

        async with self.sessions() as db:
            # Put latest CV at version=2 so legacy_cv_id can be version=0 (older), making latest_published_course_version return latest_cv_id.
            latest_cv = await db.get(CourseVersion, latest_cv_id)
            latest_cv.status = "draft"
            await db.flush()
            latest_cv.version = 2
            latest_cv.status = "published"
            await db.flush()
            await _seed_legacy_course_version(db, cv_id=legacy_cv_id, version_num=1)

            labs, legacy_lessons = (
                await db.execute(
                    select(Lab).where(Lab.course_version_id == legacy_cv_id).order_by(Lab.order_no)
                ),
                (
                    await db.execute(
                        select(Lesson)
                        .where(Lesson.course_version_id == legacy_cv_id)
                        .order_by(Lesson.order_no)
                    )
                )
                .scalars()
                .all(),
            )
            lab_list = list(labs.scalars())

            # Class A pinned on legacy_cv_id v1 (published), with 3 videos disabled in Lab 1 (11/14).
            ccv_a = ClassCourseVersion(
                class_id=self.class_a,
                version=1,
                course_version_id=legacy_cv_id,
                status="draft",
                lab_settings=[
                    {"lab_id": lab.id, "enabled": True, "prerequisites": [0] if lab.id == 1 else []}
                    for lab in lab_list
                ],
            )
            db.add(ccv_a)
            await db.flush()
            db.add(Prerequisite(class_id=self.class_a, version=1, lab_id=1, required_lab_id=0))
            for item in legacy_lessons:
                params = {}
                if item.id == "document":
                    params = {"markdown": "Tài liệu riêng của lớp 1."}
                if item.id == "quiz-0-1":
                    params = {"max_attempts": 4, "cooldown_minutes": 10}
                enabled = item.id != "video-1-1"
                required = item.type in {"quiz", "labtest"} or item.id == "document"
                db.add(
                    ClassLessonSetting(
                        class_id=self.class_a,
                        version=1,
                        lesson_id=item.id,
                        course_version_id=legacy_cv_id,
                        enabled=enabled,
                        required=required,
                        order_no=item.order_no,
                        params=params,
                        status="draft",
                    )
                )
            await db.flush()

            # Published custom bank on legacy_cv_id for quiz-0-1 & labtest-0 & labtest-1 & quiz-0-2..3.
            for key, lab_id, custom_prompt in (
                ("quiz-0-1", 0, "Câu hỏi tùy chỉnh riêng của lớp 1 trước nâng cấp?"),
                ("quiz-0-2", 0, "Câu hỏi 0-2 lớp 1?"),
                ("quiz-0-3", 0, "Câu hỏi 0-3 lớp 1?"),
                ("labtest-0", 0, "Câu hỏi Lab Test 0 lớp 1?"),
                ("labtest-1", 1, "Câu hỏi Lab Test 1 lớp 1?"),
            ):
                b = QuestionBank(
                    id=f"old-{key}",
                    class_id=self.class_a,
                    course_version_id=legacy_cv_id,
                    lab_id=lab_id,
                    lesson_id=key,
                    version=1,
                    status="draft",
                    created_by=2,
                )
                db.add(b)
                await db.flush()
                q_payload = question(1)
                q_payload["prompt"] = custom_prompt
                db.add(
                    QuestionVersion(
                        id=f"qv-{key}",
                        bank_id=b.id,
                        question_id=f"qid-{key}",
                        content=q_payload,
                        status="approved",
                        reviewer=2,
                        reviewed_at=now(),
                    )
                )
                await db.flush()
                b.status = "published"
                b.published_by = 2
                db.add(
                    QuizPolicy(
                        class_id=self.class_a,
                        lesson_id=key,
                        lab_id=lab_id,
                        bank_id=b.id,
                        num_questions=1,
                        pass_score=1,
                        time_limit_minutes=15,
                        max_attempts=4 if key == "quiz-0-1" else 5,
                        cooldown_minutes=10 if key == "quiz-0-1" else 30,
                    )
                )
            for s in (
                await db.execute(
                    select(ClassLessonSetting).where(
                        ClassLessonSetting.class_id == self.class_a,
                        ClassLessonSetting.version == 1,
                    )
                )
            ).scalars():
                s.status = "published"
            await db.flush()
            ccv_a.status = "published"

            # Add student progress & PracticeSubmission & CompletionOverride on legacy_cv_id.
            member_a = (
                await db.execute(
                    select(ClassMembership).where(
                        ClassMembership.class_id == self.class_a,
                        ClassMembership.user_id == 4,
                    )
                )
            ).scalar_one()
            prog_doc = LessonProgress(
                membership_id=member_a.id,
                lesson_id="document",
                lesson_version=f"{legacy_cv_id}/document",
                course_version_id=legacy_cv_id,
                status="completed",
                completed_at=now(),
            )
            prog_prac = LessonProgress(
                membership_id=member_a.id,
                lesson_id="Lab1-03_Button",
                lesson_version=f"{legacy_cv_id}/Lab1-03_Button",
                course_version_id=legacy_cv_id,
                status="completed",
                completed_at=now(),
            )
            prog_uart1 = LessonProgress(
                membership_id=member_a.id,
                lesson_id="Lab1-06_Serial_Communication",
                lesson_version=f"{legacy_cv_id}/Lab1-06_Serial_Communication",
                course_version_id=legacy_cv_id,
                status="completed",
                completed_at=now(),
            )
            prog_uart2 = LessonProgress(
                membership_id=member_a.id,
                lesson_id="Lab1-07_Serial_Control_LED",
                lesson_version=f"{legacy_cv_id}/Lab1-07_Serial_Control_LED",
                course_version_id=legacy_cv_id,
                status="completed",
                completed_at=now(),
            )
            db.add_all([prog_doc, prog_prac, prog_uart1, prog_uart2])
            await db.flush()
            db.add(
                PracticeSubmission(
                    progress_id=prog_prac.id,
                    revision=1,
                    code="void setup() {} void loop() {}",
                    rubric_snapshot="Nút nhấn",
                    status="approved",
                    feedback="Tốt",
                    reviewed_by=2,
                    reviewed_at=now(),
                )
            )
            db.add(
                CompletionOverride(
                    membership_id=member_a.id,
                    class_id=self.class_a,
                    version=1,
                    action="unlock",
                    lab_id=2,
                    actor=2,
                    reason="Mở khóa kiểm thử",
                )
            )

            # Class B is on latest_cv_id v2 but has older disabled video settings (8/10, 34/37).
            latest_labs = list(
                (
                    await db.execute(
                        select(Lab)
                        .where(Lab.course_version_id == latest_cv_id)
                        .order_by(Lab.order_no)
                    )
                ).scalars()
            )
            latest_lessons = list(
                (
                    await db.execute(
                        select(Lesson)
                        .where(Lesson.course_version_id == latest_cv_id)
                        .order_by(Lesson.order_no)
                    )
                ).scalars()
            )
            ccv_b = ClassCourseVersion(
                class_id=self.class_b,
                version=1,
                course_version_id=latest_cv_id,
                status="draft",
                lab_settings=[
                    {"lab_id": lab.id, "enabled": True, "prerequisites": []} for lab in latest_labs
                ],
            )
            db.add(ccv_b)
            await db.flush()
            for item in latest_lessons:
                db.add(
                    ClassLessonSetting(
                        class_id=self.class_b,
                        version=1,
                        lesson_id=item.id,
                        course_version_id=latest_cv_id,
                        enabled=(item.type != "video"),
                        required=(item.type in {"quiz", "labtest"}),
                        order_no=item.order_no,
                        params={"markdown": "Lab 0 Doc"} if item.id == "document" else {},
                        status="draft",
                    )
                )
            await db.commit()

        # Verify teacher sees course_upgrade_available=True on class_a, while student never sees it.
        teacher_draft_a = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()
        self.assertTrue(teacher_draft_a["course_upgrade_available"])
        self.assertEqual(teacher_draft_a["latest_course_version_id"], latest_cv_id)
        student_curr_a = (
            await self.call(4, "GET", f"/api/classes/{self.class_a}/curriculum?student_view=true")
        ).json()
        self.assertNotIn("course_upgrade_available", student_curr_a)

        # Student cannot call upgrade-course-version.
        self.assertEqual(
            (
                await self.call(4, "POST", f"/api/classes/{self.class_a}/upgrade-course-version")
            ).status_code,
            403,
        )

        # Run sync_classes_to_latest_course across both classes (simulating `--sync-classes`).
        async with self.sessions() as db:
            reports = await sync_classes_to_latest_course(db, enable_all_lessons=True)
        self.assertTrue(all(r["upgraded"] for r in reports), reports)

        curr_a = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()
        curr_b = (
            await self.call(3, "GET", f"/api/classes/{self.class_b}/curriculum?draft=true")
        ).json()
        self.assertEqual(curr_a["course_version_id"], latest_cv_id)
        self.assertEqual(curr_b["course_version_id"], latest_cv_id)
        self.assertFalse(curr_a["course_upgrade_available"])
        self.assertEqual(curr_a["status"], "published")

        # Both classes now have identical max enabled lesson counts per lab (164/164, 100%).
        counts_a = [sum(1 for x in lab["lessons"] if x["enabled"]) for lab in curr_a["labs"]]
        counts_b = [sum(1 for x in lab["lessons"] if x["enabled"]) for lab in curr_b["labs"]]
        totals = [len(lab["lessons"]) for lab in curr_a["labs"]]
        self.assertEqual(counts_a, [10, 31, 12, 23, 35, 15, 12, 14, 12])
        self.assertEqual(counts_a, totals)
        self.assertEqual(counts_b, totals)

        # Teacher params & custom questions on class_a preserved; newly added quiz-1-1 & quiz-doc-2-1 got samples & auto-published.
        doc_lesson = next(x for x in curr_a["labs"][0]["lessons"] if x["id"] == "document")
        self.assertEqual(doc_lesson["params"]["markdown"], "Tài liệu riêng của lớp 1.")
        q01_bank = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/lessons/quiz-0-1/question-bank")
        ).json()
        self.assertEqual(q01_bank["status"], "published")
        self.assertEqual(q01_bank["policy"]["max_attempts"], 4)
        self.assertEqual(
            q01_bank["questions"][0]["prompt"], "Câu hỏi tùy chỉnh riêng của lớp 1 trước nâng cấp?"
        )
        q11_bank = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/lessons/quiz-1-1/question-bank")
        ).json()
        self.assertEqual(q11_bank["status"], "published")
        self.assertEqual(q11_bank["approved_count"], 90)
        q21_bank = (
            await self.call(
                2, "GET", f"/api/classes/{self.class_a}/lessons/quiz-doc-2-1/question-bank"
            )
        ).json()
        self.assertEqual(q21_bank["status"], "published")
        self.assertEqual(q21_bank["approved_count"], 141)

        # Student progress & submission & unlock preserved on new CourseVersion:
        # partial child completion -> grouped practice stays in_progress; full child completion -> completed!
        async with self.sessions() as db:
            new_prog_doc = (
                await db.execute(
                    select(LessonProgress).where(
                        LessonProgress.course_version_id == latest_cv_id,
                        LessonProgress.lesson_id == "document",
                    )
                )
            ).scalar_one()
            self.assertEqual(new_prog_doc.status, "completed")
            new_prog_prac = (
                await db.execute(
                    select(LessonProgress).where(
                        LessonProgress.course_version_id == latest_cv_id,
                        LessonProgress.lesson_id == "practice-1-button",
                    )
                )
            ).scalar_one()
            self.assertEqual(new_prog_prac.status, "in_progress")
            copied_sub = (
                await db.execute(
                    select(PracticeSubmission).where(
                        PracticeSubmission.progress_id == new_prog_prac.id
                    )
                )
            ).scalar_one()
            self.assertEqual(copied_sub.status, "approved")
            self.assertTrue(copied_sub.code.startswith("// === Lab1-04_Button ==="))
            new_prog_uart = (
                await db.execute(
                    select(LessonProgress).where(
                        LessonProgress.course_version_id == latest_cv_id,
                        LessonProgress.lesson_id == "practice-1-uart",
                    )
                )
            ).scalar_one()
            self.assertEqual(new_prog_uart.status, "completed")
            unlock = (
                await db.execute(
                    select(CompletionOverride).where(
                        CompletionOverride.class_id == self.class_a,
                        CompletionOverride.version == 2,
                        CompletionOverride.lab_id == 2,
                    )
                )
            ).scalar_one()
            self.assertEqual(unlock.action, "unlock")

        # Calling POST upgrade-course-version when already on latest is idempotent (no-op).
        idem = await self.call(2, "POST", f"/api/classes/{self.class_a}/upgrade-course-version")
        self.assertEqual(idem.status_code, 200, idem.text)
        self.assertFalse(idem.json()["upgrade"]["upgraded"])

    async def test_teacher_upgrade_endpoint_preserves_disabled_lessons_when_requested(self):
        latest_cv_id = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()["course_version_id"]
        legacy_cv_id = "cubesat-legacy-v0-teacher"
        async with self.sessions() as db:
            latest_cv = await db.get(CourseVersion, latest_cv_id)
            latest_cv.status = "draft"
            await db.flush()
            latest_cv.version = 2
            latest_cv.status = "published"
            await db.flush()
            await _seed_legacy_course_version(db, cv_id=legacy_cv_id, version_num=1)
            labs = list(
                (
                    await db.execute(select(Lab).where(Lab.course_version_id == legacy_cv_id))
                ).scalars()
            )
            lessons = list(
                (
                    await db.execute(select(Lesson).where(Lesson.course_version_id == legacy_cv_id))
                ).scalars()
            )
            db.add(
                ClassCourseVersion(
                    class_id=self.class_a,
                    version=1,
                    course_version_id=legacy_cv_id,
                    status="draft",
                    lab_settings=[
                        {"lab_id": lab.id, "enabled": True, "prerequisites": []} for lab in labs
                    ],
                )
            )
            await db.flush()
            for item in lessons:
                disabled_old = {
                    "Lab1-01_Blink_LED",
                    "Lab1-02_Control_Multiple_LEDs",
                    "Lab1-05_7_Segment_LED",
                }
                db.add(
                    ClassLessonSetting(
                        class_id=self.class_a,
                        version=1,
                        lesson_id=item.id,
                        course_version_id=legacy_cv_id,
                        enabled=item.id not in disabled_old,
                        required=item.type in {"quiz", "labtest"} or item.id == "document",
                        order_no=item.order_no,
                        params={"markdown": "Doc 0"} if item.id == "document" else {},
                        status="draft",
                    )
                )
            await db.commit()

        res = await self.call(2, "POST", f"/api/classes/{self.class_a}/upgrade-course-version")
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertTrue(body["upgrade"]["upgraded"])
        self.assertEqual(body["course_version_id"], latest_cv_id)
        disabled_group = next(x for x in body["labs"][1]["lessons"] if x["id"] == "practice-1-led")
        self.assertFalse(disabled_group["enabled"])
        disabled_single = next(
            x for x in body["labs"][1]["lessons"] if x["id"] == "Lab1-06_7_Segment_LED"
        )
        self.assertFalse(disabled_single["enabled"])
        added_item = next(x for x in body["labs"][1]["lessons"] if x["id"] == "practice-1-button")
        self.assertTrue(added_item["enabled"])

    async def test_sync_classes_preserve_mode_upgrades_old_cv_and_leaves_latest_disabled_untouched(
        self,
    ):
        latest_cv_id = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()["course_version_id"]
        legacy_cv_id = "cubesat-legacy-preserve"
        async with self.sessions() as db:
            latest_cv = await db.get(CourseVersion, latest_cv_id)
            latest_cv.status = "draft"
            await db.flush()
            latest_cv.version = 2
            latest_cv.status = "published"
            await db.flush()
            await _seed_legacy_course_version(db, cv_id=legacy_cv_id, version_num=1)

            legacy_labs = list(
                (
                    await db.execute(
                        select(Lab)
                        .where(Lab.course_version_id == legacy_cv_id)
                        .order_by(Lab.order_no)
                    )
                ).scalars()
            )
            legacy_lessons = list(
                (
                    await db.execute(
                        select(Lesson)
                        .where(Lesson.course_version_id == legacy_cv_id)
                        .order_by(Lesson.order_no)
                    )
                ).scalars()
            )
            db.add(
                ClassCourseVersion(
                    class_id=self.class_a,
                    version=1,
                    course_version_id=legacy_cv_id,
                    status="draft",
                    lab_settings=[
                        {"lab_id": lab.id, "enabled": True, "prerequisites": []}
                        for lab in legacy_labs
                    ],
                )
            )
            await db.flush()
            for item in legacy_lessons:
                db.add(
                    ClassLessonSetting(
                        class_id=self.class_a,
                        version=1,
                        lesson_id=item.id,
                        course_version_id=legacy_cv_id,
                        enabled=item.id
                        not in {"Lab1-01_Blink_LED", "Lab1-02_Control_Multiple_LEDs"},
                        required=item.type in {"quiz", "labtest"} or item.id == "document",
                        order_no=item.order_no,
                        params={"markdown": "Doc 0"} if item.id == "document" else {},
                        status="draft",
                    )
                )

            latest_labs = list(
                (
                    await db.execute(
                        select(Lab)
                        .where(Lab.course_version_id == latest_cv_id)
                        .order_by(Lab.order_no)
                    )
                ).scalars()
            )
            latest_lessons = list(
                (
                    await db.execute(
                        select(Lesson)
                        .where(Lesson.course_version_id == latest_cv_id)
                        .order_by(Lesson.order_no)
                    )
                ).scalars()
            )
            db.add(
                ClassCourseVersion(
                    class_id=self.class_b,
                    version=1,
                    course_version_id=latest_cv_id,
                    status="draft",
                    lab_settings=[
                        {"lab_id": lab.id, "enabled": True, "prerequisites": []}
                        for lab in latest_labs
                    ],
                )
            )
            await db.flush()
            for item in latest_lessons:
                db.add(
                    ClassLessonSetting(
                        class_id=self.class_b,
                        version=1,
                        lesson_id=item.id,
                        course_version_id=latest_cv_id,
                        enabled=item.id != "video-1-1",
                        required=item.type in {"quiz", "labtest"},
                        order_no=item.order_no,
                        params={"markdown": "Lab 0 Doc"} if item.id == "document" else {},
                        status="draft",
                    )
                )
            await db.commit()

        async with self.sessions() as db:
            reports = await sync_classes_to_latest_course(db, enable_all_lessons=False)
        by_class = {r["class_id"]: r for r in reports}
        self.assertTrue(by_class[self.class_a]["upgraded"])
        self.assertFalse(by_class[self.class_b]["upgraded"])

        curr_a = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()
        self.assertEqual(curr_a["course_version_id"], latest_cv_id)
        self.assertEqual(
            [len(lab["lessons"]) for lab in curr_a["labs"]], [10, 31, 12, 23, 35, 15, 12, 14, 12]
        )
        self.assertFalse(
            next(x for x in curr_a["labs"][1]["lessons"] if x["id"] == "practice-1-led")["enabled"]
        )
        self.assertTrue(
            next(x for x in curr_a["labs"][1]["lessons"] if x["id"] == "practice-1-button")[
                "enabled"
            ]
        )

        curr_b = (
            await self.call(3, "GET", f"/api/classes/{self.class_b}/curriculum?draft=true")
        ).json()
        self.assertFalse(
            next(x for x in curr_b["labs"][1]["lessons"] if x["id"] == "video-1-1")["enabled"]
        )

        # Newly created class defaults directly to the latest 164-lesson grouped curriculum.
        created = await self.call(
            2, "POST", "/api/classes", {"code": "NEWGRP1", "name": "New Grouped Class"}
        )
        self.assertIn(created.status_code, (200, 201), created.text)
        new_id = created.json()["id"]
        curr_new = (
            await self.call(2, "GET", f"/api/classes/{new_id}/curriculum?draft=true")
        ).json()
        self.assertEqual(curr_new["course_version_id"], latest_cv_id)
        self.assertEqual(
            [len(lab["lessons"]) for lab in curr_new["labs"]],
            [10, 31, 12, 23, 35, 15, 12, 14, 12],
        )

    async def test_reset_doc_overrides_clears_markdown_and_is_idempotent(self):
        draft = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()
        body = {
            "expected_version": draft["version"],
            "course_version_id": draft["course_version_id"],
            "labs": [
                {
                    "lab_id": lab["id"],
                    "enabled": True,
                    "prerequisites": lab.get("prerequisites", []),
                }
                for lab in draft["labs"]
            ],
            "lessons": [
                {
                    "lesson_id": item["id"],
                    "enabled": item["id"] != "video-1-1",
                    "required": item["required"],
                    "order_no": item["order_no"],
                    "params": (
                        {"markdown": "Nội dung cũ cần thay"}
                        if item["id"] == "document-2-1"
                        else {"markdown": "Tổng kết riêng của lớp"}
                        if item["id"] == "summary-0"
                        else item.get("params", {})
                    ),
                }
                for lab in draft["labs"]
                for item in lab["lessons"]
            ],
        }
        saved = await self.call(2, "PUT", f"/api/classes/{self.class_a}/settings", body)
        self.assertEqual(saved.status_code, 200, saved.text)
        pub = await self.call(
            2,
            "POST",
            f"/api/classes/{self.class_a}/publish",
            {"expected_version": saved.json()["version"]},
        )
        self.assertEqual(pub.status_code, 200, pub.text)

        async with self.sessions() as db:
            first = await sync_classes_to_latest_course(
                db, enable_all_lessons=False, reset_doc_overrides=True
            )
            first_map = {r["class_id"]: r for r in first}
            self.assertTrue(first_map[self.class_a]["upgraded"])
            second = await sync_classes_to_latest_course(
                db, enable_all_lessons=False, reset_doc_overrides=True
            )
            second_map = {r["class_id"]: r for r in second}
            self.assertFalse(second_map[self.class_a]["upgraded"])

        refreshed = (
            await self.call(2, "GET", f"/api/classes/{self.class_a}/curriculum?draft=true")
        ).json()
        self.assertEqual(refreshed["status"], "published")
        self.assertFalse(
            next(x for x in refreshed["labs"][1]["lessons"] if x["id"] == "video-1-1")["enabled"]
        )
        doc21 = next(x for x in refreshed["labs"][2]["lessons"] if x["id"] == "document-2-1")
        self.assertNotIn("markdown", doc21["params"])
        self.assertTrue(doc21["content"]["markdown"].startswith("# Doc 2.1:"))
        sum0 = next(x for x in refreshed["labs"][0]["lessons"] if x["id"] == "summary-0")
        self.assertEqual(sum0["content"]["markdown"], "Tổng kết riêng của lớp")


@unittest.skipUnless(
    os.getenv("PSCUBESAT_TEST_POSTGRES") == "1", "Opt-in PostgreSQL integration test"
)
class CurriculumSyncPostgresTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = migrations.MigrationTests.asyncSetUp
    asyncTearDown = migrations.MigrationTests.asyncTearDown
    admin_connection = migrations.MigrationTests.admin_connection
    assert_schema_matches = migrations.MigrationTests.assert_schema_matches
    cli = class_pg.ClassPostgresTests.cli
    call = classes.ClassAPITests.call

    async def test_postgres_triggers_allow_published_class_upgrade_and_sync(self):
        await self.cli("upgrade", "head")
        await classes.ClassAPITests.setup_client(self)
        try:
            async with self.sessions() as db:
                await _seed_legacy_course_version(db, cv_id="cubesat-pg-legacy", version_num=1)
                report = await seed_curriculum(db)
                latest_cv_id = report["course_version_id"]
                await db.commit()

            await classes.ClassAPITests.add_student(self)
            async with self.sessions() as db:
                labs = list(
                    (
                        await db.execute(
                            select(Lab)
                            .where(Lab.course_version_id == "cubesat-pg-legacy")
                            .order_by(Lab.order_no)
                        )
                    ).scalars()
                )
                lessons = list(
                    (
                        await db.execute(
                            select(Lesson)
                            .where(Lesson.course_version_id == "cubesat-pg-legacy")
                            .order_by(Lesson.order_no)
                        )
                    ).scalars()
                )
                ccv = ClassCourseVersion(
                    class_id=self.class_a,
                    version=1,
                    course_version_id="cubesat-pg-legacy",
                    status="draft",
                    lab_settings=[
                        {
                            "lab_id": lab.id,
                            "enabled": True,
                            "prerequisites": [0] if lab.id == 1 else [],
                        }
                        for lab in labs
                    ],
                )
                db.add(ccv)
                await db.flush()
                db.add(Prerequisite(class_id=self.class_a, version=1, lab_id=1, required_lab_id=0))
                for item in lessons:
                    db.add(
                        ClassLessonSetting(
                            class_id=self.class_a,
                            version=1,
                            lesson_id=item.id,
                            course_version_id="cubesat-pg-legacy",
                            enabled=item.id != "video-1-1",
                            required=item.type in {"quiz", "labtest"} or item.id == "document",
                            order_no=item.order_no,
                            params={"markdown": "Doc"} if item.id == "document" else {},
                            status="draft",
                        )
                    )
                await db.flush()

                for key, lab_id in (
                    ("quiz-0-1", 0),
                    ("quiz-0-2", 0),
                    ("quiz-0-3", 0),
                    ("labtest-0", 0),
                    ("labtest-1", 1),
                ):
                    b = QuestionBank(
                        id=f"pg-old-{key}",
                        class_id=self.class_a,
                        course_version_id="cubesat-pg-legacy",
                        lab_id=lab_id,
                        lesson_id=key,
                        version=1,
                        status="draft",
                        created_by=2,
                    )
                    db.add(b)
                    await db.flush()
                    db.add(
                        QuestionVersion(
                            id=f"pg-qv-{key}",
                            bank_id=b.id,
                            question_id=f"pg-qid-{key}",
                            content=question(1),
                            status="approved",
                            reviewer=2,
                            reviewed_at=now(),
                        )
                    )
                    await db.flush()
                    b.status = "published"
                    b.published_by = 2
                    db.add(
                        QuizPolicy(
                            class_id=self.class_a,
                            lesson_id=key,
                            lab_id=lab_id,
                            bank_id=b.id,
                            num_questions=1,
                            pass_score=1,
                            time_limit_minutes=15,
                            max_attempts=5,
                            cooldown_minutes=30,
                        )
                    )
                for s in (
                    await db.execute(
                        select(ClassLessonSetting).where(
                            ClassLessonSetting.class_id == self.class_a,
                            ClassLessonSetting.version == 1,
                        )
                    )
                ).scalars():
                    s.status = "published"
                await db.flush()
                ccv.status = "published"
                await db.flush()

                member = (
                    await db.execute(
                        select(ClassMembership).where(
                            ClassMembership.class_id == self.class_a,
                            ClassMembership.user_id == 4,
                        )
                    )
                ).scalar_one()
                att = QuizAttempt(
                    id=str(uuid4()),
                    class_id=self.class_a,
                    membership_id=member.id,
                    lab_id=0,
                    lesson_id="quiz-0-1",
                    lesson_version="cubesat-pg-legacy/quiz-0-1",
                    course_version_id="cubesat-pg-legacy",
                    bank_id="pg-old-quiz-0-1",
                    number=1,
                    status="submitted",
                    policy={
                        "pass_score": 1,
                        "max_attempts": 5,
                        "time_limit_minutes": 15,
                        "reveal_policy": "after_pass",
                    },
                    started_at=now(),
                    expires_at=now(),
                    submitted_at=now(),
                    score=1,
                )
                db.add(att)
                await db.flush()
                db.add(
                    QuizAttemptItem(
                        id=str(uuid4()),
                        attempt_id=att.id,
                        question_version_id="pg-qv-quiz-0-1",
                        position=0,
                        snapshot=question(1),
                    )
                )
                prog = LessonProgress(
                    membership_id=member.id,
                    lesson_id="Lab1-03_Button",
                    lesson_version="cubesat-pg-legacy/Lab1-03_Button",
                    course_version_id="cubesat-pg-legacy",
                    status="completed",
                    completed_at=now(),
                )
                db.add(prog)
                await db.flush()
                db.add(
                    PracticeSubmission(
                        progress_id=prog.id,
                        revision=1,
                        code="void setup() {} void loop() {}",
                        rubric_snapshot="Nút nhấn",
                        status="approved",
                        reviewed_by=2,
                        reviewed_at=now(),
                    )
                )
                await db.commit()

            # Execute sync against real PostgreSQL with autoflush=False (matching get_session_maker) and all triggers enabled.
            from sqlalchemy.ext.asyncio import async_sessionmaker

            prod_sessions = async_sessionmaker(self.engine, expire_on_commit=False, autoflush=False)
            async with prod_sessions() as db:
                result = await upgrade_class_to_course_version(
                    db,
                    classroom_id=self.class_a,
                    actor_id=2,
                    enable_all_lessons=True,
                    commit=True,
                )
            self.assertTrue(result["upgraded"])
            self.assertEqual(result["status"], "published")
            self.assertEqual(result["upgraded_to"], latest_cv_id)

            async with self.sessions() as db:
                new_ccv = await db.get(ClassCourseVersion, (self.class_a, 2))
                self.assertEqual(new_ccv.status, "published")
                self.assertEqual(new_ccv.course_version_id, latest_cv_id)
                lab1_count = (
                    await db.execute(
                        select(func.count())
                        .select_from(ClassLessonSetting)
                        .join(
                            Lesson,
                            (Lesson.course_version_id == ClassLessonSetting.course_version_id)
                            & (Lesson.id == ClassLessonSetting.lesson_id),
                        )
                        .where(
                            ClassLessonSetting.class_id == self.class_a,
                            ClassLessonSetting.version == 2,
                            Lesson.lab_id == 1,
                            ClassLessonSetting.enabled.is_(True),
                        )
                    )
                ).scalar_one()
                self.assertEqual(lab1_count, 31)
                # Historical snapshot v1 & historical QuizAttempt stay untouched.
                old_ccv = await db.get(ClassCourseVersion, (self.class_a, 1))
                self.assertEqual(old_ccv.course_version_id, "cubesat-pg-legacy")
                self.assertEqual(
                    (await db.execute(select(func.count()).select_from(QuizAttempt))).scalar_one(),
                    1,
                )
                self.assertEqual(
                    (
                        await db.execute(select(func.count()).select_from(PracticeSubmission))
                    ).scalar_one(),
                    2,
                )
        finally:
            await self.client.aclose()
            self.redis_patch.stop()
            self.flag_patch.stop()
