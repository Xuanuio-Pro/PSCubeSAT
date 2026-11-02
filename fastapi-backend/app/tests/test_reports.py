"""Per-class pilot switch, legacy redirects, class reports and the Admin dashboard."""

import csv
import io
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.models.learning import ProgressEvent
from app.models.tables import AuditLog, ClassMembership, LabProgress, User
from app.tests import test_course_configuration as course
from app.tests import test_quizzes as quizzes
from app.tests.test_e2e import create_legacy_table


class ReportAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.quiz = quizzes.QuizAPITests()
        await self.quiz.asyncSetUp()
        self.learning = self.quiz.learning
        self.fixture = self.learning.fixture
        self.sessions, self.base = self.quiz.sessions, self.quiz.base
        self.class_a, self.class_b = self.fixture.class_a, self.fixture.class_b
        await create_legacy_table(self.fixture)

    async def asyncTearDown(self):
        await self.quiz.asyncTearDown()

    async def call(self, user, method, url, body=None):
        return await self.fixture.call(user, method, url, body)

    async def mode(self, value, user=1):
        return await self.call(
            user,
            "PATCH",
            f"/api/admin/classes/{self.class_a}/lms-mode",
            {"lms_mode": value, "reason": "Pilot rollback drill"},
        )

    async def entry(self, user=4, lab=0, lesson="document"):
        query = f"/api/lms/lab-entry?lab_id={lab}" + (f"&lesson={lesson}" if lesson else "")
        result = await self.call(user, "GET", query)
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    async def add_user(self, uid, role="user"):
        async with self.sessions() as db:
            db.add(
                User(
                    id=uid,
                    email=f"user{uid}@example.com",
                    password_hash=hash_password("secret123"),
                    role=role,
                )
            )
            await db.commit()
        self.fixture.fixture.tokens[uid] = create_access_token({"sub": str(uid)})

    async def test_read_only_and_off_modes_with_legacy_gate(self):
        await self.quiz.prepare()
        await self.learning.complete(0)
        attempt = (await self.quiz.start()).json()
        legacy = "/api/progress"
        self.assertEqual((await self.call(4, "GET", legacy)).status_code, 403)
        denied = await self.mode("read_only", user=2)
        self.assertEqual((denied.status_code, denied.json()["code"]), (403, "FORBIDDEN_ROLE"))
        self.assertEqual((await self.mode("paused")).status_code, 422)
        changed = await self.mode("read_only")
        self.assertEqual(changed.json()["lms_mode"], "read_only")
        async with self.sessions() as db:
            row = (
                await db.execute(select(AuditLog).where(AuditLog.action == "class.lms_mode"))
            ).scalar_one()
            self.assertEqual(row.before, {"lms_mode": "enabled"})
        # Every write is refused; reads, results and reports remain.
        save = {
            "idempotency_key": str(uuid4()),
            "expected_revision": 0,
            "answers": {attempt["items"][0]["id"]: attempt["items"][0]["choices"][0]["id"]},
        }
        for user, method, url, body in (
            (
                4,
                "POST",
                self.base + "/lessons/document/events",
                {"idempotency_key": str(uuid4()), "kind": "document_read"},
            ),
            (4, "PUT", f"/api/attempts/{attempt['id']}/answers", save),
            (4, "POST", f"/api/attempts/{attempt['id']}/submit", None),
            (2, "PUT", self.base + "/settings", self.learning.body),
        ):
            result = await self.call(user, method, url, body)
            self.assertEqual((result.status_code, result.json()["code"]), (409, "CLASS_READ_ONLY"))
        for user, url in (
            (4, f"/api/attempts/{attempt['id']}/result"),
            (4, self.base + "/learning-path"),
            (4, self.quiz.attempt_url),
            (2, self.base + "/reports"),
        ):
            self.assertEqual((await self.call(user, "GET", url)).status_code, 200, url)
        # Rollback never widens access: the student stays off the legacy path.
        self.assertEqual((await self.call(4, "GET", legacy)).status_code, 403)
        config = (await self.call(4, "GET", "/api/lms/config")).json()
        self.assertEqual(config, {"class_mode": True, "legacy_allowed": False})
        self.assertEqual((await self.entry())["target"], "experience")
        await self.mode("off")
        self.assertEqual((await self.call(4, "GET", self.base + "/learning-path")).status_code, 403)
        self.assertEqual((await self.call(4, "GET", legacy)).status_code, 200)
        self.assertEqual((await self.entry())["target"], "legacy")
        self.assertEqual((await self.call(2, "GET", self.base + "/reports")).status_code, 200)
        await self.mode("enabled")
        saved = await self.call(4, "PUT", f"/api/attempts/{attempt['id']}/answers", save)
        self.assertEqual(saved.status_code, 200, saved.text)

    async def test_lab_entry_one_many_none(self):
        self.assertEqual(
            await self.entry(),
            {"target": "class", "class_id": self.class_a, "lesson_id": "document"},
        )
        self.assertEqual((await self.entry(lab=1, lesson=None))["class_id"], self.class_a)
        # Unknown/disabled lesson is not a valid destination; a pilot student falls to experience.
        self.assertEqual((await self.entry(lesson="no-such-lesson"))["target"], "experience")
        self.assertEqual((await self.entry(user=2))["target"], "legacy")
        added = await self.call(
            3, "POST", f"/api/classes/{self.class_b}/members", {"email": "user4@example.com"}
        )
        self.assertEqual(added.status_code, 200, added.text)
        self.assertEqual((await self.entry())["target"], "class")  # B has no published program.
        draft = (
            await self.call(3, "GET", f"/api/classes/{self.class_b}/curriculum?draft=true")
        ).json()
        body = course.settings_payload(draft)
        for item in body["lessons"]:
            item["required"] = item["lesson_id"] == "document" or item["lesson_id"].startswith(
                "summary-"
            )
            if item["lesson_id"] == "document":
                item["params"] = {"markdown": "Tài liệu lớp B (dữ liệu kiểm thử)."}
        saved = await self.call(3, "PUT", f"/api/classes/{self.class_b}/settings", body)
        self.assertEqual(saved.status_code, 200, saved.text)
        published = await self.call(
            3,
            "POST",
            f"/api/classes/{self.class_b}/publish",
            {"expected_version": saved.json()["version"]},
        )
        self.assertEqual(published.status_code, 200, published.text)
        choose = await self.entry(lesson=None)
        self.assertEqual(choose["target"], "choose")
        self.assertEqual({c["id"] for c in choose["classes"]}, {self.class_a, self.class_b})
        with patch.object(get_settings(), "lms_class_mode", False):
            self.assertEqual((await self.entry())["target"], "legacy")

    async def test_report_contents_csv_injection_and_scope(self):
        async with self.sessions() as db:
            user = await db.get(User, 4)
            user.full_name = '=HYPERLINK("http://x")'
            db.add(LabProgress(id=1, user_id=4, lab_id=1, compiled_at=datetime.now(timezone.utc)))
            await db.commit()
        await self.learning.complete(0)
        report = (await self.call(2, "GET", self.base + "/reports")).json()
        row = report["students"][0]
        self.assertEqual((row["completed_labs"], row["legacy_compiled_labs"]), (1, [1]))
        self.assertTrue(row["labs"][0]["completed"])
        # Legacy builds never count as completion.
        self.assertFalse(row["labs"][1]["completed"])
        self.assertIsNotNone(row["last_activity_at"])
        self.assertEqual(report["summary"]["active_students"], 1)
        response = await self.call(2, "GET", self.base + "/reports?format=csv")
        self.assertIn("attachment", response.headers["content-disposition"])
        rows = list(csv.reader(io.StringIO(response.text.lstrip("\ufeff"))))
        self.assertEqual(rows[1][1], '\'=HYPERLINK("http://x")')
        self.assertEqual(rows[1][9], "1")
        for user in (3, 4):
            self.assertEqual(
                (await self.call(user, "GET", self.base + "/reports")).status_code, 403
            )
        await self.call(2, "DELETE", self.base + "/members", {"user_id": 4})
        removed = (await self.call(2, "GET", self.base + "/reports")).json()
        self.assertEqual(removed["students"][0]["membership_status"], "removed")
        self.assertEqual(removed["summary"]["active_students"], 0)

    async def test_dashboard_counts_and_activity_definition(self):
        await self.add_user(7)
        added = await self.call(2, "POST", self.base + "/members", {"email": "user7@example.com"})
        self.assertEqual(added.status_code, 200, added.text)
        await self.learning.complete(0)
        async with self.sessions() as db:
            member = (
                await db.execute(select(ClassMembership).where(ClassMembership.user_id == 7))
            ).scalar_one()
            now = datetime.now(timezone.utc)
            db.add_all(
                [
                    ProgressEvent(
                        idempotency_key="old-activity",
                        membership_id=member.id,
                        lesson_version="x",
                        kind="opened",
                        payload_hash="x",
                        response={},
                        created_at=now - timedelta(days=20),
                    ),
                    # A teacher override is not learner activity.
                    ProgressEvent(
                        idempotency_key="teacher-override",
                        membership_id=member.id,
                        lesson_version="x",
                        kind="override",
                        payload_hash="x",
                        response={},
                        created_at=now,
                    ),
                ]
            )
            await db.commit()
        self.assertEqual((await self.call(2, "GET", "/api/admin/dashboard")).status_code, 403)
        data = (await self.call(1, "GET", "/api/admin/dashboard")).json()
        self.assertEqual(data["active_students"], {"last_7_days": 1, "last_30_days": 2})
        self.assertEqual(data["users"]["teacher"]["active"], 2)
        self.assertEqual(data["users"]["user"]["active"], 2)
        self.assertEqual(data["classes"]["by_status"]["active"], 2)
        self.assertEqual(data["classes"]["by_mode"], {"enabled": 2})
        lab0 = next(lab for lab in data["labs"] if lab["id"] == 0)
        self.assertEqual((lab0["eligible_students"], lab0["completed_students"]), (2, 1))
        self.assertEqual(lab0["completion_rate"], 0.5)
        self.assertIsNone(lab0["average_best_score"])
        self.assertIn("đăng nhập không được tính", data["definitions"]["active_students"])
