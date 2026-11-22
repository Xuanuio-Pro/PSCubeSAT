"""Unit, API, and migration tests for unlimited quiz attempts and Lab Test cooldown batches."""

import os
import subprocess
import sys
import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import asyncpg
from dotenv import dotenv_values
from sqlalchemy import select

from app.models.quiz import QuestionBank, QuizAttempt, QuizAttemptItem
from app.models.tables import ClassMembership
from app.services.quizzes import compute_retry_state
from app.tests import test_learning as learning


def _fake_attempt(
    number,
    *,
    started_at,
    submitted_at=None,
    expires_at=None,
    status="submitted",
    score=0,
    pass_score=8,
    max_attempts=5,
    cooldown_minutes=30,
    reveal_policy="after_pass",
    revealed_at=None,
):
    return SimpleNamespace(
        id=f"att-{number}",
        number=number,
        status=status,
        score=score,
        started_at=started_at,
        submitted_at=submitted_at,
        expires_at=expires_at or (started_at + timedelta(minutes=15)),
        revealed_at=revealed_at,
        policy={
            "pass_score": pass_score,
            "max_attempts": max_attempts,
            "cooldown_minutes": cooldown_minutes,
            "reveal_policy": reveal_policy,
        },
    )


def _fake_grant(created_at, extra_attempts=1, key="grant-1"):
    return SimpleNamespace(
        created_at=created_at,
        extra_attempts=extra_attempts,
        idempotency_key=key,
    )


class RetryStateUnitTests(unittest.TestCase):
    def test_unlimited_mode_allows_retakes_until_passed(self):
        t0 = datetime(2026, 11, 22, 10, 0, tzinfo=timezone.utc)
        rows = [
            _fake_attempt(
                i + 1,
                started_at=t0 + timedelta(minutes=i),
                submitted_at=t0 + timedelta(minutes=i, seconds=30),
                score=1,
                pass_score=2,
                max_attempts=None,
                cooldown_minutes=0,
            )
            for i in range(10)
        ]
        state = compute_retry_state(
            rows,
            [],
            max_attempts=None,
            cooldown_minutes=0,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=11),
        )
        self.assertTrue(state["unlimited"])
        self.assertIsNone(state["remaining_attempts"])
        self.assertTrue(state["can_start"])
        self.assertFalse(state["locked"])

        rows.append(
            _fake_attempt(
                11,
                started_at=t0 + timedelta(minutes=12),
                submitted_at=t0 + timedelta(minutes=13),
                score=2,
                pass_score=2,
                max_attempts=None,
                cooldown_minutes=0,
                revealed_at=t0 + timedelta(minutes=13),
            )
        )
        after_pass = compute_retry_state(
            rows,
            [],
            max_attempts=None,
            cooldown_minutes=0,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=14),
        )
        self.assertTrue(after_pass["locked"])
        self.assertFalse(after_pass["can_start"])

    def test_cooldown_batches_expired_anchor_and_grants(self):
        t0 = datetime(2026, 11, 22, 10, 0, tzinfo=timezone.utc)
        rows = [
            _fake_attempt(
                i + 1,
                started_at=t0 + timedelta(minutes=i),
                submitted_at=t0 + timedelta(minutes=i, seconds=30),
                score=0,
            )
            for i in range(4)
        ]
        # 5th attempt expired at T0 + 19m, even if finalized later by worker at T0 + 25m.
        rows.append(
            _fake_attempt(
                5,
                started_at=t0 + timedelta(minutes=4),
                expires_at=t0 + timedelta(minutes=19),
                submitted_at=t0 + timedelta(minutes=25),
                status="expired",
                score=0,
            )
        )

        # At T0 + 48m59s (29m59s after expires_at=T0+19m): still in cooldown.
        mid = compute_retry_state(
            rows,
            [],
            max_attempts=5,
            cooldown_minutes=30,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=48, seconds=59),
        )
        self.assertFalse(mid["can_start"])
        self.assertEqual(mid["remaining_attempts"], 0)
        self.assertEqual(mid["cooldown_until"], t0 + timedelta(minutes=49))
        self.assertEqual(mid["cooldown_remaining_seconds"], 1)

        # At T0 + 49m (30m after expires_at): fresh batch of 5 opens.
        opened = compute_retry_state(
            rows,
            [],
            max_attempts=5,
            cooldown_minutes=30,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=49),
        )
        self.assertTrue(opened["can_start"])
        self.assertEqual(opened["remaining_attempts"], 5)
        self.assertIsNone(opened["cooldown_until"])

        # Teacher grants +2 during cooldown at T0 + 26m -> unlocks immediately for 2 tries.
        grants = [_fake_grant(t0 + timedelta(minutes=26), extra_attempts=2)]
        granted = compute_retry_state(
            rows,
            grants,
            max_attempts=5,
            cooldown_minutes=30,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=27),
        )
        self.assertTrue(granted["can_start"])
        self.assertEqual(granted["remaining_attempts"], 2)
        self.assertIsNone(granted["cooldown_until"])

        # Using both granted attempts (6, 7) and failing starts a new 30m cooldown from attempt 7 end.
        rows.extend(
            [
                _fake_attempt(
                    6,
                    started_at=t0 + timedelta(minutes=28),
                    submitted_at=t0 + timedelta(minutes=29),
                ),
                _fake_attempt(
                    7,
                    started_at=t0 + timedelta(minutes=30),
                    submitted_at=t0 + timedelta(minutes=31),
                ),
            ]
        )
        second_cd = compute_retry_state(
            rows,
            grants,
            max_attempts=5,
            cooldown_minutes=30,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=35),
        )
        self.assertFalse(second_cd["can_start"])
        self.assertEqual(second_cd["cooldown_until"], t0 + timedelta(minutes=61))

        # Waiting past T0 + 61m opens a fresh 5-attempt batch again.
        third_batch = compute_retry_state(
            rows,
            grants,
            max_attempts=5,
            cooldown_minutes=30,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=61),
        )
        self.assertTrue(third_batch["can_start"])
        self.assertEqual(third_batch["remaining_attempts"], 5)

    def test_legacy_unpassed_reveal_unstuck_only_when_repeatable(self):
        t0 = datetime(2026, 11, 22, 10, 0, tzinfo=timezone.utc)
        stuck_rows = [
            _fake_attempt(
                i + 1,
                started_at=t0 + timedelta(minutes=i),
                submitted_at=t0 + timedelta(minutes=i, seconds=20),
                score=0,
                pass_score=2,
                max_attempts=3,
                cooldown_minutes=0,
                reveal_policy="after_pass",
                revealed_at=(t0 + timedelta(minutes=3)) if i == 2 else None,
            )
            for i in range(3)
        ]
        hard_locked = compute_retry_state(
            stuck_rows,
            [],
            max_attempts=3,
            cooldown_minutes=0,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=5),
        )
        self.assertTrue(hard_locked["locked"])
        self.assertFalse(hard_locked["can_start"])

        unstuck = compute_retry_state(
            stuck_rows,
            [],
            max_attempts=None,
            cooldown_minutes=0,
            reveal_policy="after_pass",
            closes_at=None,
            current_time=t0 + timedelta(minutes=5),
        )
        self.assertFalse(unstuck["locked"])
        self.assertTrue(unstuck["can_start"])

        immediate_rows = [
            _fake_attempt(
                1,
                started_at=t0,
                submitted_at=t0 + timedelta(seconds=10),
                score=0,
                pass_score=2,
                reveal_policy="immediate",
                revealed_at=t0 + timedelta(seconds=10),
            )
        ]
        immediate_locked = compute_retry_state(
            immediate_rows,
            [],
            max_attempts=None,
            cooldown_minutes=0,
            reveal_policy="immediate",
            closes_at=None,
            current_time=t0 + timedelta(minutes=5),
        )
        self.assertTrue(immediate_locked["locked"])
        self.assertFalse(immediate_locked["can_start"])


class QuizCooldownAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.learning = learning.LearningAPITests()
        await self.learning.asyncSetUp()
        self.fixture = self.learning.fixture
        self.sessions = self.learning.sessions
        self.base = self.learning.base

    async def asyncTearDown(self):
        await self.learning.asyncTearDown()

    async def call(self, user, method, url, body=None):
        return await self.fixture.call(user, method, url, body)

    async def enable_lab0(self, *extra_lessons):
        body = deepcopy(self.learning.body)
        for item in body["lessons"]:
            if item["lesson_id"] in extra_lessons:
                item.update(enabled=True, required=True)
        await self.learning.apply(body)

    async def submit_attempt(self, attempt_url, *, pass_all):
        started = await self.call(4, "POST", attempt_url, {"idempotency_key": str(uuid4())})
        self.assertEqual(started.status_code, 200, started.text)
        attempt = started.json()
        if pass_all:
            async with self.sessions() as db:
                answers = {
                    item.id: item.snapshot["correct_choice_id"]
                    for item in (
                        await db.execute(
                            select(QuizAttemptItem).where(
                                QuizAttemptItem.attempt_id == attempt["id"]
                            )
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
                    "answers": answers,
                },
            )
            self.assertEqual(saved.status_code, 200, saved.text)
        submitted = await self.call(4, "POST", f"/api/attempts/{attempt['id']}/submit")
        self.assertEqual(submitted.status_code, 200, submitted.text)
        return submitted.json()

    async def test_unlimited_quiz_allows_retakes_beyond_3_and_reveals_on_pass(self):
        await self.enable_lab0("quiz-0-1")
        await self.learning.complete_lesson("document")
        attempt_url = f"{self.base}/lessons/quiz-0-1/attempts"

        for idx in range(5):
            res = await self.submit_attempt(attempt_url, pass_all=False)
            self.assertFalse(res["passed"], idx)
            self.assertFalse(res["revealed"], idx)
            self.assertTrue(res["unlimited_attempts"])
            self.assertTrue(res["can_retry"])
            self.assertIsNone(res["remaining_attempts"])
            self.assertNotIn("correct_choice_id", str(res))

        passed = await self.submit_attempt(attempt_url, pass_all=True)
        self.assertTrue(passed["passed"])
        self.assertTrue(passed["revealed"])
        self.assertFalse(passed["can_retry"])
        self.assertIn("correct_choice_id", passed["items"][0])

        blocked = await self.call(4, "POST", attempt_url, {"idempotency_key": str(uuid4())})
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.json()["code"], "ATTEMPT_LIMIT_REACHED")

    async def test_labtest_default_5_attempts_and_30m_cooldown_repeats_until_pass(self):
        await self.enable_lab0("labtest-0")
        await self.learning.complete(0)
        attempt_url = f"{self.base}/labs/0/attempts"

        t_base = datetime(2026, 11, 22, 12, 0, tzinfo=timezone.utc)
        for i in range(5):
            with patch("app.services.quizzes.now", return_value=t_base + timedelta(minutes=i)):
                res = await self.submit_attempt(attempt_url, pass_all=False)
                self.assertEqual(res["policy"]["max_attempts"], 5)
                self.assertEqual(res["policy"]["cooldown_minutes"], 30)
                self.assertFalse(res["revealed"])
                if i < 4:
                    self.assertTrue(res["can_retry"])
                    self.assertEqual(res["remaining_attempts"], 4 - i)
                    self.assertIsNone(res["cooldown_until"])
                else:
                    self.assertFalse(res["can_retry"])
                    self.assertEqual(res["remaining_attempts"], 0)
                    self.assertIsNotNone(res["cooldown_until"])
                    self.assertEqual(res["cooldown_remaining_seconds"], 1800)
                    last_id = res["id"]

        # During 30m cooldown (at +29m): blocked with structured cooldown details.
        with patch("app.services.quizzes.now", return_value=t_base + timedelta(minutes=33)):
            blocked = await self.call(4, "POST", attempt_url, {"idempotency_key": str(uuid4())})
            self.assertEqual(blocked.status_code, 409)
            self.assertEqual(blocked.json()["code"], "ATTEMPT_LIMIT_REACHED")
            self.assertIn("cooldown_until", blocked.json()["details"])
            self.assertEqual(blocked.json()["details"]["retry_after_seconds"], 60)

            still_waiting = await self.call(4, "GET", f"/api/attempts/{last_id}/result")
            self.assertFalse(still_waiting.json()["can_retry"])
            self.assertFalse(still_waiting.json()["revealed"])

        # After 30m cooldown (+30m from 5th attempt at t_base+4m -> t_base+34m): fresh 5-attempt batch opens.
        with patch("app.services.quizzes.now", return_value=t_base + timedelta(minutes=34)):
            refreshed = await self.call(4, "GET", f"/api/attempts/{last_id}/result")
            self.assertTrue(refreshed.json()["can_retry"])
            self.assertEqual(refreshed.json()["remaining_attempts"], 5)
            self.assertIsNone(refreshed.json()["cooldown_until"])

            passed = await self.submit_attempt(attempt_url, pass_all=True)
            self.assertTrue(passed["passed"])
            self.assertTrue(passed["revealed"])
            self.assertFalse(passed["can_retry"])

        path = await self.learning.path()
        self.assertTrue(path["labs"][0]["completed"])
        self.assertEqual(path["labs"][1]["access"], "available")

    async def test_teacher_grant_lifts_cooldown_immediately_then_resumes(self):
        await self.enable_lab0("labtest-0")
        await self.learning.complete(0)
        attempt_url = f"{self.base}/labs/0/attempts"
        t_base = datetime(2026, 11, 22, 12, 0, tzinfo=timezone.utc)

        for i in range(5):
            with patch("app.services.quizzes.now", return_value=t_base + timedelta(minutes=i)):
                res = await self.submit_attempt(attempt_url, pass_all=False)
                last_id = res["id"]

        async with self.sessions() as db:
            member_id = (
                await db.execute(select(ClassMembership.id).where(ClassMembership.user_id == 4))
            ).scalar_one()

        # Teacher grants 2 extra attempts while student is in cooldown.
        grant_res = await self.call(
            2,
            "POST",
            f"{self.base}/labs/0/attempt-grants",
            {
                "membership_id": member_id,
                "extra_attempts": 2,
                "reason": "Hỗ trợ làm lại ngay sau ôn tập",
                "idempotency_key": str(uuid4()),
            },
        )
        self.assertEqual(grant_res.status_code, 200, grant_res.text)

        # Grant timestamp is real UTC now; verify with real UTC now (within seconds of grant).
        res_after = await self.call(4, "GET", f"/api/attempts/{last_id}/result")
        self.assertTrue(res_after.json()["can_retry"])
        self.assertEqual(res_after.json()["remaining_attempts"], 2)
        self.assertIsNone(res_after.json()["cooldown_until"])

        att6 = await self.submit_attempt(attempt_url, pass_all=False)
        self.assertTrue(att6["can_retry"])
        self.assertEqual(att6["remaining_attempts"], 1)

        att7 = await self.submit_attempt(attempt_url, pass_all=False)
        self.assertFalse(att7["can_retry"])
        self.assertEqual(att7["remaining_attempts"], 0)
        self.assertIsNotNone(att7["cooldown_until"])

    async def test_legacy_stuck_student_on_quiz_is_unstuck_and_keeps_history(self):
        await self.enable_lab0("quiz-0-3", "summary-0")
        await self.learning.complete_lesson("document")

        # Insert 3 failed historical attempts on quiz-0-3 with old revealed_at lock.
        async with self.sessions() as db:
            member_id = (
                await db.execute(select(ClassMembership.id).where(ClassMembership.user_id == 4))
            ).scalar_one()
            bank = (
                await db.execute(
                    select(QuestionBank).where(
                        QuestionBank.class_id == self.fixture.class_a,
                        QuestionBank.lesson_id == "quiz-0-3",
                    )
                )
            ).scalar_one()
            cv_id = bank.course_version_id
            old_t = datetime(2026, 11, 21, 10, 0, tzinfo=timezone.utc)
            last_id = None
            for idx in range(1, 4):
                att_id = str(uuid4())
                last_id = att_id
                db.add(
                    QuizAttempt(
                        id=att_id,
                        class_id=self.fixture.class_a,
                        membership_id=member_id,
                        lab_id=0,
                        lesson_id="quiz-0-3",
                        lesson_version=f"{cv_id}/quiz-0-3",
                        course_version_id=cv_id,
                        bank_id=bank.id,
                        number=idx,
                        status="submitted",
                        policy={
                            "pass_score": 2,
                            "max_attempts": 3,
                            "time_limit_minutes": 10,
                            "reveal_policy": "after_pass",
                        },
                        started_at=old_t + timedelta(minutes=idx),
                        expires_at=old_t + timedelta(minutes=idx + 10),
                        submitted_at=old_t + timedelta(minutes=idx, seconds=30),
                        revealed_at=(old_t + timedelta(minutes=4)) if idx == 3 else None,
                        score=1 if idx == 1 else 0,
                    )
                )
            await db.commit()

        # Student sees can_retry=True on attempt 3 and can immediately take attempt 4 and pass.
        res3 = await self.call(4, "GET", f"/api/attempts/{last_id}/result")
        self.assertEqual(res3.status_code, 200, res3.text)
        self.assertTrue(res3.json()["can_retry"])
        self.assertTrue(res3.json()["unlimited_attempts"])

        att4 = await self.submit_attempt(f"{self.base}/lessons/quiz-0-3/attempts", pass_all=True)
        self.assertEqual(att4["number"], 4)
        self.assertTrue(att4["passed"])

        path = await self.learning.path()
        lessons = {item["id"]: item for item in path["labs"][0]["lessons"]}
        self.assertEqual(lessons["quiz-0-3"]["status"], "completed")
        self.assertEqual(lessons["summary-0"]["access"], "available")

    async def test_class_lesson_params_override_and_validation(self):
        body = deepcopy(self.learning.body)
        for item in body["lessons"]:
            if item["lesson_id"] == "quiz-0-1":
                item.update(
                    enabled=True, required=True, params={"max_attempts": 2, "cooldown_minutes": 15}
                )
            if item["lesson_id"] == "labtest-0":
                item.update(
                    enabled=True,
                    required=True,
                    params={"max_attempts": None, "cooldown_minutes": 0},
                )
        await self.learning.apply(body)
        await self.learning.complete_lesson("document")

        # Invalid params are rejected with 422.
        for bad_params in (
            {"max_attempts": 0},
            {"cooldown_minutes": -1},
            {"cooldown_minutes": 1441},
        ):
            bad_body = deepcopy(self.learning.body)
            for item in bad_body["lessons"]:
                if item["lesson_id"] == "quiz-0-1":
                    item["params"] = bad_params
            bad_res = await self.fixture.save(bad_body)
            self.assertEqual(bad_res.status_code, 422, bad_params)

        # quiz-0-1 with overridden (2 attempts, 15m cooldown) blocks after 2 failures.
        q_url = f"{self.base}/lessons/quiz-0-1/attempts"
        t0 = datetime(2026, 11, 22, 12, 0, tzinfo=timezone.utc)
        with patch("app.services.quizzes.now", return_value=t0):
            await self.submit_attempt(q_url, pass_all=False)
            res2 = await self.submit_attempt(q_url, pass_all=False)
            self.assertFalse(res2["can_retry"])
            self.assertIsNotNone(res2["cooldown_until"])

        # After completing quiz-0-1 after 15m (and summary-0), labtest-0 allows unlimited attempts (>5).
        with patch("app.services.quizzes.now", return_value=t0 + timedelta(minutes=16)):
            await self.submit_attempt(q_url, pass_all=True)
        await self.learning.complete_lesson("summary-0")

        lt_url = f"{self.base}/labs/0/attempts"
        for _ in range(6):
            res = await self.submit_attempt(lt_url, pass_all=False)
            self.assertTrue(res["unlimited_attempts"])
            self.assertTrue(res["can_retry"])


class Migration0022PostgresTests(unittest.IsolatedAsyncioTestCase):
    @unittest.skipUnless(
        os.getenv("PSCUBESAT_TEST_POSTGRES") == "1",
        "Set PSCUBESAT_TEST_POSTGRES=1 to run PostgreSQL migration tests.",
    )
    async def test_0022_migrates_legacy_defaults_and_downgrades_cleanly(self):
        backend_root = Path(__file__).resolve().parents[2]
        env_values = dotenv_values(backend_root / ".env")
        admin_password = os.getenv("POSTGRES_ADMIN_PASSWORD") or env_values.get(
            "POSTGRES_ADMIN_PASSWORD"
        )
        app_password = os.getenv("POSTGRES_PASSWORD") or env_values.get("POSTGRES_PASSWORD")
        if not admin_password or not app_password:
            self.skipTest("PostgreSQL credentials missing in environment or .env")

        db_name = f"pscubesat_mig0022_{uuid4().hex[:8]}"
        admin_conn = await asyncpg.connect(
            host="127.0.0.1", user="postgres", password=admin_password, database="postgres"
        )
        await admin_conn.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
        await admin_conn.execute(f'CREATE DATABASE "{db_name}" OWNER cubesat')
        await admin_conn.close()

        try:
            asyncpg_url = f"postgresql://cubesat:{app_password}@127.0.0.1:5432/{db_name}"
            alembic_url = f"postgresql+asyncpg://cubesat:{app_password}@127.0.0.1:5432/{db_name}"
            sub_env = {**os.environ, "DATABASE_URL": alembic_url}

            def run_alembic(*args: str):
                return subprocess.run(
                    [sys.executable, "-m", "alembic", *args],
                    cwd=backend_root,
                    env=sub_env,
                    check=True,
                    capture_output=True,
                    text=True,
                )

            run_alembic("upgrade", "0021_default_sample_quiz_banks")

            conn = await asyncpg.connect(dsn=asyncpg_url)
            try:
                user_id = await conn.fetchval(
                    """INSERT INTO users(email, password_hash, role)
                       VALUES ('mig0022@test.local', 'hash', 'teacher')
                       RETURNING id"""
                )
                class_id = await conn.fetchval(
                    """INSERT INTO classes(code, name, status, created_by)
                       VALUES ('MIG0022', 'Migration 0022 Class', 'active', $1)
                       RETURNING id""",
                    user_id,
                )
                await conn.executemany(
                    """INSERT INTO quiz_policies(
                           class_id, lesson_id, lab_id, num_questions, pass_score, time_limit_minutes, max_attempts
                       ) VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                    [
                        (class_id, "quiz-0-1", 0, 3, 2, 10, 3),
                        (class_id, "quiz-0-2", 0, 3, 2, 10, 4),
                        (class_id, "labtest-0", 0, 10, 8, 15, 3),
                        (class_id, "labtest-1", 1, 10, 8, 15, 2),
                    ],
                )
            finally:
                await conn.close()

            run_alembic("upgrade", "head")

            conn = await asyncpg.connect(dsn=asyncpg_url)
            try:
                rows = await conn.fetch(
                    """SELECT lesson_id, max_attempts, cooldown_minutes
                       FROM quiz_policies
                       WHERE class_id = $1""",
                    class_id,
                )
                by_lesson = {
                    row["lesson_id"]: (row["max_attempts"], row["cooldown_minutes"]) for row in rows
                }
                self.assertEqual(by_lesson["quiz-0-1"], (None, 0))
                self.assertEqual(by_lesson["quiz-0-2"], (4, 0))
                self.assertEqual(by_lesson["labtest-0"], (5, 30))
                self.assertEqual(by_lesson["labtest-1"], (2, 0))

                with self.assertRaises(asyncpg.CheckViolationError):
                    async with conn.transaction():
                        await conn.execute(
                            """UPDATE quiz_policies
                               SET cooldown_minutes = 1441
                               WHERE class_id = $1 AND lesson_id = 'quiz-0-1'""",
                            class_id,
                        )
            finally:
                await conn.close()

            run_alembic("downgrade", "-1")

            conn = await asyncpg.connect(dsn=asyncpg_url)
            try:
                has_col = await conn.fetchval(
                    """SELECT COUNT(*)
                       FROM information_schema.columns
                       WHERE table_name = 'quiz_policies' AND column_name = 'cooldown_minutes'"""
                )
                self.assertEqual(has_col, 0)
                rows = await conn.fetch(
                    """SELECT lesson_id, max_attempts
                       FROM quiz_policies
                       WHERE class_id = $1""",
                    class_id,
                )
                by_lesson = {row["lesson_id"]: row["max_attempts"] for row in rows}
                self.assertEqual(by_lesson["quiz-0-1"], 3)
                self.assertEqual(by_lesson["quiz-0-2"], 4)
                self.assertEqual(by_lesson["labtest-0"], 3)
                self.assertEqual(by_lesson["labtest-1"], 2)
            finally:
                await conn.close()

            run_alembic("upgrade", "head")

            conn = await asyncpg.connect(dsn=asyncpg_url)
            try:
                rows = await conn.fetch(
                    """SELECT lesson_id, max_attempts, cooldown_minutes
                       FROM quiz_policies
                       WHERE class_id = $1""",
                    class_id,
                )
                by_lesson = {
                    row["lesson_id"]: (row["max_attempts"], row["cooldown_minutes"]) for row in rows
                }
                self.assertEqual(by_lesson["quiz-0-1"], (None, 0))
                self.assertEqual(by_lesson["quiz-0-2"], (4, 0))
                self.assertEqual(by_lesson["labtest-0"], (5, 30))
                self.assertEqual(by_lesson["labtest-1"], (2, 0))
            finally:
                await conn.close()
        finally:
            drop_conn = await asyncpg.connect(
                host="127.0.0.1", user="postgres", password=admin_password, database="postgres"
            )
            await drop_conn.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
            await drop_conn.close()
