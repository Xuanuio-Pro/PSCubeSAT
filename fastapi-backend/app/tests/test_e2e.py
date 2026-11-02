"""Cross-role release flow through the real HTTP API (plan 11, Sprint 5 item 7).

Admin promotes a teacher -> teacher creates class, adds a student, configures and
publishes, builds and publishes the Lab 0 bank through import + review -> student
learns Lab 0, passes the Lab Test, unlocks Lab 1/2 -> teacher and Admin read reports.
Question content is synthetic (mechanics only, no subject-matter answers).
"""

import json
import unittest
from uuid import uuid4

from sqlalchemy import Integer, func, select

from app.core.security import create_access_token, hash_password
from app.models.learning import ProgressEvent
from app.models.tables import LabProgress, User
from app.tests import test_course_configuration as course
from app.tests.test_quizzes import question


async def cross_role_flow(t, call, sessions, tokens):
    async with sessions() as db:
        password = hash_password("secret123")
        for uid in (5, 6):
            db.add(User(id=uid, email=f"e2e{uid}@example.com", password_hash=password))
        await db.commit()
    for uid in (5, 6):
        tokens[uid] = create_access_token({"sub": str(uid), "role": "user"})

    async def ok(uid, method, url, body=None, status=200):
        response = await call(uid, method, url, body)
        t.assertEqual(response.status_code, status, f"{method} {url}: {response.text}")
        return response.json()

    # Admin grants the teacher role; public registration never can.
    await ok(1, "PATCH", "/api/admin/users/5", {"role": "teacher"})
    classroom = await ok(
        5,
        "POST",
        "/api/classes",
        {"code": "E2E-PILOT", "name": "Lớp pilot", "status": "active"},
        status=201,
    )
    t.assertEqual(classroom["lms_mode"], "enabled")
    base = f"/api/classes/{classroom['id']}"
    await ok(5, "POST", base + "/members", {"email": "e2e6@example.com"})

    async def apply(body):
        saved = await ok(5, "PUT", base + "/settings", body)
        body = course.settings_payload(saved)
        await ok(5, "POST", base + "/publish", {"expected_version": body["expected_version"]})
        return body

    body = course.settings_payload(await ok(5, "GET", base + "/curriculum?draft=true"))
    for item in body["lessons"]:
        item["required"] = item["lesson_id"] == "document" or item["lesson_id"].startswith(
            "summary-"
        )
        if item["lesson_id"] == "document":
            item["params"] = {"markdown": "Định hướng học tập (dữ liệu kiểm thử)."}
    body = await apply(body)

    # Bank: import 20 drafts, approve each, publish exactly 20.
    bank_url = base + "/labs/0/question-bank"
    bank = await ok(5, "GET", bank_url)
    payload = json.dumps({"questions": [question(i) for i in range(20)]})
    bank = await ok(
        5,
        "POST",
        bank_url + "/import",
        {"expected_revision": bank["revision"], "format": "json", "content": payload},
    )
    t.assertEqual({q["status"] for q in bank["questions"]}, {"draft"})
    for item in bank["questions"]:
        bank = await ok(
            5,
            "POST",
            f"{bank_url}/questions/{item['id']}/review",
            {"expected_revision": bank["revision"], "status": "approved"},
        )
    bank = await ok(5, "POST", bank_url + "/publish", {"expected_revision": bank["revision"]})
    t.assertEqual(bank["status"], "published")
    for item in body["lessons"]:
        if item["lesson_id"] == "labtest-0":
            item.update(enabled=True, required=True)
    await apply(body)

    # Student: Lab 0 -> Lab Test -> Lab 1/2 unlocked.
    path = await ok(6, "GET", base + "/learning-path")
    t.assertEqual([path["labs"][i]["access"] for i in (1, 2)], ["locked", "locked"])
    await ok(
        6,
        "POST",
        base + "/lessons/document/events",
        {"idempotency_key": str(uuid4()), "kind": "document_read"},
    )
    t.assertEqual((await ok(6, "GET", base + "/learning-path"))["labs"][1]["access"], "locked")
    attempt = await ok(6, "POST", base + "/labs/0/attempts", {"idempotency_key": str(uuid4())})
    t.assertEqual(len(attempt["items"]), 5)
    t.assertNotIn("correct_choice_id", json.dumps(attempt))
    # Synthetic fixtures always mark choice "a" correct; IDs survive shuffling.
    attempt = await ok(
        6,
        "PUT",
        f"/api/attempts/{attempt['id']}/answers",
        {
            "idempotency_key": str(uuid4()),
            "expected_revision": attempt["answer_revision"],
            "answers": {item["id"]: "a" for item in attempt["items"]},
        },
    )
    result = await ok(6, "POST", f"/api/attempts/{attempt['id']}/submit")
    t.assertEqual((result["score"], result["passed"]), (5, True))
    path = await ok(6, "GET", base + "/learning-path")
    t.assertTrue(path["labs"][0]["completed"])
    t.assertEqual([path["labs"][i]["access"] for i in (1, 2)], ["available", "available"])

    # Teacher report and CSV; student cannot read the class report.
    report = await ok(5, "GET", base + "/reports")
    row = next(s for s in report["students"] if s["user_id"] == 6)
    t.assertEqual(row["completed_labs"], 1)
    t.assertEqual((row["labs"][0]["best_score"], row["labs"][0]["attempts"]), (5, 1))
    t.assertEqual(row["attempts_total"], 1)
    t.assertIsNotNone(row["last_activity_at"])
    csv = await call(5, "GET", base + "/reports?format=csv")
    t.assertEqual(csv.status_code, 200)
    t.assertIn("e2e6@example.com", csv.text)
    t.assertEqual((await call(6, "GET", base + "/reports")).status_code, 403)

    dashboard = await ok(1, "GET", "/api/admin/dashboard")
    t.assertGreaterEqual(dashboard["active_students"]["last_7_days"], 1)
    lab0 = next(lab for lab in dashboard["labs"] if lab["id"] == 0)
    t.assertGreaterEqual(lab0["completed_students"], 1)
    t.assertIsNotNone(lab0["average_best_score"])
    async with sessions() as db:
        graded = (
            await db.execute(
                select(func.count())
                .select_from(ProgressEvent)
                .where(ProgressEvent.kind == "labtest_graded")
            )
        ).scalar_one()
    t.assertEqual(graded, 1)
    return classroom


async def create_legacy_table(fixture):
    column = LabProgress.__table__.c.id
    fixture.fixture.original_types.append((column, column.type))
    column.type = column.type.with_variant(Integer(), "sqlite")
    async with fixture.fixture.engine.begin() as conn:
        await conn.run_sync(lambda sync: LabProgress.__table__.create(sync))


class CrossRoleE2ETests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.fixture = course.CurriculumAPITests()
        await self.fixture.asyncSetUp()
        await create_legacy_table(self.fixture)

    async def asyncTearDown(self):
        await self.fixture.asyncTearDown()

    async def test_admin_teacher_student_report_flow(self):
        await cross_role_flow(
            self, self.fixture.call, self.fixture.sessions, self.fixture.fixture.tokens
        )
