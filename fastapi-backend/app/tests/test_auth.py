"""Run: python -m unittest app.tests.test_auth (requires aiosqlite)."""

import io
import unittest
from datetime import timedelta
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from loguru import logger
from sqlalchemy import JSON, Integer, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.google_auth import verify_google_credential
from app.core.logging import configure_console_encoding, mask_email
from app.core.security import create_access_token, hash_password
from app.db import get_db
from app.models.db_models import (
    Base,
    EmailVerificationToken,
    GoogleIdentity,
    PasswordResetToken,
    RevokedToken,
    User,
)
from app.models.tables import AuditLog
from app.routers import compiler, curriculum, health
from app.routers.admin import router as admin_router
from app.routers.auth import router
from app.services.auth import LOGIN_FAILURES, PAIR_FAILURES


class AuthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # These tests cover the legacy (non-class) path; do not inherit LMS_CLASS_MODE from a local .env.
        lms_flag = patch.object(get_settings(), "lms_class_mode", False)
        lms_flag.start()
        self.addCleanup(lms_flag.stop)
        # Never inherit SMTP from a local .env: tests must not send real mail or change flow.
        smtp_off = patch.object(get_settings(), "smtp_host", "")
        smtp_off.start()
        self.addCleanup(smtp_off.stop)
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.original_types = []
        for table in (User.__table__, AuditLog.__table__):
            col = table.c.id
            self.original_types.append((col, col.type))
            col.type = col.type.with_variant(Integer(), "sqlite")
        for col in (AuditLog.__table__.c.before, AuditLog.__table__.c.after):
            self.original_types.append((col, col.type))
            col.type = col.type.with_variant(JSON(), "sqlite")
        async with self.engine.begin() as conn:
            await conn.run_sync(
                lambda c: Base.metadata.create_all(
                    c,
                    tables=[
                        User.__table__,
                        GoogleIdentity.__table__,
                        RevokedToken.__table__,
                        AuditLog.__table__,
                        PasswordResetToken.__table__,
                        EmailVerificationToken.__table__,
                    ],
                )
            )
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)
        for service_router in [compiler.router, curriculum.router, health.router]:
            app.include_router(service_router)
        register_exception_handlers(app)

        async def test_db():
            async with self.sessions() as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        self.redis_patch = patch("app.services.auth.get_redis", return_value=None)
        self.redis_patch.start()
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        LOGIN_FAILURES.clear()

    async def asyncTearDown(self):
        await self.client.aclose()
        self.redis_patch.stop()
        await self.engine.dispose()
        for col, original in self.original_types:
            col.type = original

    async def register(self, email="student@gmail.com", password="Secret123!"):
        return await self.client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "full_name": "Nguyễn Văn A"},
        )

    async def google(self, **overrides):
        claims = {
            "sub": "google-123",
            "email": "student@gmail.com",
            "email_verified": True,
            "name": "Google User",
            **overrides,
        }
        with patch("app.routers.auth.verify_google_credential", AsyncMock(return_value=claims)):
            return await self.client.post("/api/auth/google", json={"credential": "test-token"})

    async def login(self, password, email="student@gmail.com"):
        return await self.client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )

    async def test_repeated_wrong_passwords_lock_the_email_and_address_pair(self):
        await self.register()
        for _ in range(PAIR_FAILURES):
            self.assertEqual((await self.login("wrong-pass")).status_code, 401)
        locked = await self.login("Secret123!")
        self.assertEqual(locked.status_code, 429, locked.text)
        self.assertEqual(locked.json()["code"], "LOGIN_LOCKED")
        self.assertGreater(locked.json()["details"]["retry_after"], 0)
        # Another account from the same address is not affected.
        await self.register("other@gmail.com")
        self.assertEqual((await self.login("Secret123!", "other@gmail.com")).status_code, 200)

    async def test_successful_login_clears_failures_and_unknown_email_still_runs_bcrypt(self):
        await self.register()
        for _ in range(PAIR_FAILURES - 1):
            await self.login("wrong-pass")
        self.assertEqual((await self.login("Secret123!")).status_code, 200)
        self.assertEqual((await self.login("wrong-pass")).status_code, 401)
        self.assertEqual((await self.login("Secret123!")).status_code, 200)
        with patch("app.services.auth.verify_password", return_value=False) as verify:
            self.assertEqual((await self.login("x", "nobody@gmail.com")).status_code, 401)
        verify.assert_called_once()

    async def test_auth_logs_mask_email_addresses(self):
        self.assertEqual(mask_email(" Student@Gmail.com "), "st***@gmail.com")
        self.assertEqual(mask_email("not-an-email"), "***")
        lines: list[str] = []
        sink = logger.add(lines.append, format="{message} {extra}")
        try:
            await self.register()
            await self.login("Secret123!")
            await self.login("wrong-pass")
        finally:
            logger.remove(sink)
        text = "".join(lines)
        self.assertIn("st***@gmail.com", text)
        self.assertNotIn("student@gmail.com", text)

    async def test_register_login_and_me(self):
        registered = await self.register("Student@gmail.com")
        self.assertEqual(registered.status_code, 201, registered.text)
        data = registered.json()
        self.assertEqual(data["user"]["email"], "student@gmail.com")
        logged_in = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "Secret123!"}
        )
        self.assertEqual(logged_in.status_code, 200, logged_in.text)
        self.assertNotEqual(data["access_token"], logged_in.json()["access_token"])
        me = await self.client.get(
            "/api/auth/me", headers={"Authorization": "Bearer " + data["access_token"]}
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["full_name"], "Nguyễn Văn A")

    async def test_admin_login_requires_admin_route(self):
        signup = await self.client.post(
            "/api/admin/signup",
            json={
                "email": "admin@ptit.edu.vn",
                "password": "Secret123!",
                "full_name": "Administrator",
            },
        )
        self.assertEqual(signup.status_code, 201, signup.text)
        self.assertEqual(signup.json()["user"]["role"], "admin")

        response = await self.client.post(
            "/api/auth/login", json={"email": "admin@ptit.edu.vn", "password": "Secret123!"}
        )
        self.assertEqual(response.status_code, 401, response.text)
        self.assertIn("quản trị", response.json()["message"].lower())

        admin_login = await self.client.post(
            "/api/admin/login", json={"email": "admin@ptit.edu.vn", "password": "Secret123!"}
        )
        self.assertEqual(admin_login.status_code, 200, admin_login.text)
        self.assertEqual(admin_login.json()["user"]["role"], "admin")

    async def test_duplicate_and_deleted_email(self):
        await self.register()
        self.assertEqual((await self.register()).status_code, 400)
        from datetime import datetime, timezone

        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            user.deleted_at = datetime.now(timezone.utc)
            await db.commit()
        self.assertEqual((await self.register()).status_code, 400)
        self.assertEqual((await self.google()).status_code, 401)

    async def test_wrong_password_and_invalid_token(self):
        await self.register()
        response = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "wrong"}
        )
        self.assertEqual(response.status_code, 401)
        me = await self.client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"})
        self.assertEqual(me.status_code, 401)
        self.assertEqual(me.headers["www-authenticate"], "Bearer")

    async def test_persisted_hash_and_legacy_email_case(self):
        from sqlalchemy.exc import IntegrityError

        from app.core.security import verify_password

        response = await self.register("  Student@GMAIL.com  ")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertNotIn("password_hash", response.text)
        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            self.assertEqual(user.email, "student@gmail.com")
            self.assertEqual(user.full_name, "Nguyễn Văn A")
            self.assertEqual(user.role.value, "user")
            self.assertNotEqual(user.password_hash, "Secret123!")
            self.assertTrue(verify_password("Secret123!", user.password_hash))
            user.email = "Student@Gmail.com"
            await db.commit()
        login = await self.client.post(
            "/api/auth/login", json={"email": " STUDENT@gmail.com ", "password": "Secret123!"}
        )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual((await self.register()).status_code, 400)
        async with self.sessions() as db:
            db.add(User(email="STUDENT@gmail.com", password_hash="unused", role="user"))
            with self.assertRaises(IntegrityError):
                await db.commit()
            await db.rollback()

    async def test_password_limits_and_validation_response(self):
        for password in ("Sh!rt", "A!" + "x" * 71, "Ế!" * 20):
            result = await self.register(password=password)
            self.assertEqual(result.status_code, 422, result.text)
        self.assertEqual((await self.register(password="A!" + "x" * 70)).status_code, 201)

    async def test_password_policy_requires_length_uppercase_and_special_character(self):
        rejected = {
            "Ab1!xyz": "8 ký tự",
            "secret123!": "in hoa",
            "Secret1234": "ký tự đặc biệt",
            "Secret 1234": "ký tự đặc biệt",
        }
        for password, reason in rejected.items():
            result = await self.register(password=password)
            self.assertEqual(result.status_code, 422, password)
            self.assertIn(reason, result.text)
        self.assertEqual((await self.register(password="Abcdef1@")).status_code, 201)

    async def test_weak_password_rejected_on_change_but_old_weak_login_allowed(self):
        data = (await self.register()).json()
        headers = {"Authorization": "Bearer " + data["access_token"]}
        weak = await self.client.patch(
            "/api/auth/password",
            json={"current_password": "Secret123!", "new_password": "newsecret123"},
            headers=headers,
        )
        self.assertEqual(weak.status_code, 422, weak.text)
        async with self.sessions() as db:
            user = (await db.execute(select(User).where(User.email == "student@gmail.com"))).scalar_one()
            user.password_hash = hash_password("weakold1")
            await db.commit()
        self.assertEqual((await self.login("weakold1")).status_code, 200)

    async def test_change_password(self):
        data = (await self.register()).json()
        response = await self.client.patch(
            "/api/auth/password",
            json={"current_password": "Secret123!", "new_password": "NewSecret123!!"},
            headers={"Authorization": "Bearer " + data["access_token"]},
        )
        self.assertEqual(response.status_code, 200, response.text)
        login = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "NewSecret123!!"}
        )
        self.assertEqual(login.status_code, 200)

    async def test_google_create_and_repeat_uses_subject(self):
        first = await self.google()
        self.assertEqual(first.status_code, 200, first.text)
        second = await self.google(email="renamed@gmail.com")
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(first.json()["user"]["id"], second.json()["user"]["id"])
        async with self.sessions() as db:
            self.assertEqual(len((await db.execute(select(User))).scalars().all()), 1)
            self.assertEqual(len((await db.execute(select(GoogleIdentity))).scalars().all()), 1)

    async def test_google_links_authoritative_email(self):
        user_id = (await self.register()).json()["user"]["id"]
        google = await self.google()
        self.assertEqual(google.status_code, 200, google.text)
        self.assertEqual(google.json()["user"]["id"], user_id)

    async def test_google_rejects_untrusted_email_link(self):
        await self.register("person@example.com")
        response = await self.google(email="person@example.com")
        self.assertEqual(response.status_code, 401)

    async def test_google_rejects_deleted_identity(self):
        await self.google()
        from datetime import datetime, timezone

        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            user.deleted_at = datetime.now(timezone.utc)
            await db.commit()
        self.assertEqual((await self.google()).status_code, 401)

    async def test_logout_revokes_only_current_session(self):
        token = (await self.register()).json()["access_token"]
        redis = AsyncMock()
        redis.exists.return_value = False
        with patch("app.services.auth.get_redis", return_value=redis):
            response = await self.client.post(
                "/api/auth/logout", headers={"Authorization": "Bearer " + token}
            )
            self.assertEqual(response.status_code, 200)
            redis.setex.assert_awaited_once()
            redis.exists.return_value = True
            me = await self.client.get("/api/auth/me", headers={"Authorization": "Bearer " + token})
            self.assertEqual(me.status_code, 401)

    async def test_logout_without_redis_rejects_reused_token(self):
        token = (await self.register()).json()["access_token"]
        headers = {"Authorization": "Bearer " + token}
        self.assertEqual(
            (await self.client.post("/api/auth/logout", headers=headers)).status_code, 200
        )
        self.assertEqual((await self.client.get("/api/auth/me", headers=headers)).status_code, 401)
        login = await self.client.post(
            "/api/auth/login", json={"email": "student@gmail.com", "password": "Secret123!"}
        )
        self.assertEqual(login.status_code, 200)
        new_headers = {"Authorization": "Bearer " + login.json()["access_token"]}
        self.assertEqual(
            (await self.client.get("/api/auth/me", headers=new_headers)).status_code, 200
        )

    async def test_services_reject_guests_invalid_expired_and_revoked_sessions(self):
        registered = (await self.register()).json()
        token = registered["access_token"]
        expired = create_access_token(
            {"sub": str(registered["user"]["id"])}, expires_delta=timedelta(seconds=-5)
        )
        urls = [
            "/api/boards",
            "/api/labs/1/template",
            "/api/health",
            "/api/curriculum/exercises",
            "/api/curriculum/exercises/Lab1-01_Blink_LED/source",
            "/api/artifacts/missing",
            "/api/artifacts/missing/files/firmware.bin",
        ]
        with patch("app.services.compiler_svc.compile_code", AsyncMock()) as worker:
            for headers in [
                {},
                {"Authorization": "Bearer invalid"},
                {"Authorization": "Bearer " + expired},
            ]:
                for url in urls:
                    self.assertEqual(
                        (await self.client.get(url, headers=headers)).status_code, 401, url
                    )
                self.assertEqual(
                    (
                        await self.client.post(
                            "/api/compile", json={"code": "void loop() {}"}, headers=headers
                        )
                    ).status_code,
                    401,
                )
            headers = {"Authorization": "Bearer " + token}
            self.assertEqual(
                (await self.client.get("/api/boards", headers=headers)).status_code, 200
            )
            self.assertEqual(
                (await self.client.get("/api/curriculum/exercises", headers=headers)).status_code,
                200,
            )
            await self.client.post("/api/auth/logout", headers=headers)
            for url in urls:
                self.assertEqual(
                    (await self.client.get(url, headers=headers)).status_code, 401, url
                )
            worker.assert_not_awaited()

    async def test_forgot_password_no_smtp_queues_without_enumerating(self):
        config = await self.client.get("/api/auth/password-reset/config")
        self.assertEqual(config.status_code, 200)
        self.assertFalse(config.json()["smtp_enabled"])

        await self.register("student@gmail.com", "Secret123!")
        with patch.object(get_settings(), "smtp_host", ""):
            existing = await self.client.post(
                "/api/auth/forgot-password", json={"email": "STUDENT@gmail.com"}
            )
            missing = await self.client.post(
                "/api/auth/forgot-password", json={"email": "nobody@example.com"}
            )
        self.assertEqual(existing.status_code, 200)
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(existing.json(), missing.json())
        self.assertEqual(existing.json()["delivery_mode"], "admin")

        async with self.sessions() as db:
            rows = (await db.execute(select(PasswordResetToken))).scalars().all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].status, "pending")
            self.assertEqual(rows[0].source, "admin_request")
            self.assertIsNone(rows[0].token_hash)

    async def test_forgot_password_smtp_dispatches_single_use_reset_token(self):
        from urllib.parse import parse_qs, urlsplit

        await self.register("student@gmail.com", "Secret123!")
        sent = []

        async def fake_send(to_email, reset_url, ttl_minutes):
            sent.append((to_email, reset_url, ttl_minutes))

        # Trigger brute-force email lockout before reset to confirm reset unlocks login.
        for _ in range(5):
            await self.client.post(
                "/api/auth/login", json={"email": "student@gmail.com", "password": "wrong"}
            )

        with (
            patch.object(get_settings(), "smtp_host", "smtp.example.com"),
            patch.object(get_settings(), "frontend_url", "https://lms.example.com"),
            patch("app.services.password_reset.send_password_reset_email", side_effect=fake_send),
        ):
            res = await self.client.post(
                "/api/auth/forgot-password", json={"email": "student@gmail.com"}
            )
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["delivery_mode"], "email")
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][0], "student@gmail.com")
        self.assertTrue(sent[0][1].startswith("https://lms.example.com/reset-password?token="))

        raw_token = parse_qs(urlsplit(sent[0][1]).query)["token"][0]
        check = await self.client.get(f"/api/auth/reset-password/validate?token={raw_token}")
        self.assertEqual(check.status_code, 200)
        self.assertEqual(check.json(), {"valid": True})

        confirm = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "NewSecret123!!"},
        )
        self.assertEqual(confirm.status_code, 200, confirm.text)

        # Single-use token is now rejected and old password fails; new password works cleanly.
        self.assertEqual(
            (
                await self.client.get(f"/api/auth/reset-password/validate?token={raw_token}")
            ).status_code,
            400,
        )
        self.assertEqual(
            (
                await self.client.post(
                    "/api/auth/reset-password",
                    json={"token": raw_token, "new_password": "Another123!"},
                )
            ).status_code,
            400,
        )
        self.assertEqual((await self.login("Secret123!")).status_code, 401)
        self.assertEqual((await self.login("NewSecret123!!")).status_code, 200)

        async with self.sessions() as db:
            logs = (
                (
                    await db.execute(
                        select(AuditLog).where(AuditLog.action == "user.password_reset_self")
                    )
                )
                .scalars()
                .all()
            )
            self.assertEqual(len(logs), 1)
            self.assertNotIn(raw_token, f"{logs[0].before}{logs[0].after}")
            self.assertNotIn("NewSecret123!!", f"{logs[0].before}{logs[0].after}")

    async def test_forgot_password_smtp_error_falls_back_to_admin_queue(self):
        await self.register("student@gmail.com", "Secret123!")
        with (
            patch.object(get_settings(), "smtp_host", "smtp.example.com"),
            patch(
                "app.services.password_reset.send_password_reset_email",
                side_effect=OSError("smtp down"),
            ),
        ):
            res = await self.client.post(
                "/api/auth/forgot-password", json={"email": "student@gmail.com"}
            )
            missing = await self.client.post(
                "/api/auth/forgot-password", json={"email": "nobody@example.com"}
            )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), missing.json())
        async with self.sessions() as db:
            row = (await db.execute(select(PasswordResetToken))).scalar_one()
            self.assertEqual(row.status, "pending")
            self.assertEqual(row.source, "admin_request")
            self.assertIsNone(row.token_hash)

    # ── Email verification on sign-up ──────────────────────────────────────────

    def smtp_on(self, sent):
        """SMTP configured; captures (email, url) of every verification mail."""

        async def fake_send(to_email, url, ttl_hours):
            sent.append((to_email, url))

        return (
            patch.object(get_settings(), "smtp_host", "smtp.example.com"),
            patch.object(get_settings(), "frontend_url", "https://lms.example.com"),
            patch("app.services.email_verification.send_verification_email", side_effect=fake_send),
        )

    @staticmethod
    def token_of(sent, index=-1):
        from urllib.parse import parse_qs, urlsplit

        return parse_qs(urlsplit(sent[index][1]).query)["token"][0]

    async def test_register_with_smtp_requires_verification_and_blocks_login(self):
        sent = []
        a, b, c = self.smtp_on(sent)
        with a, b, c:
            res = await self.register()
            self.assertEqual(res.status_code, 201, res.text)
            body = res.json()
            self.assertTrue(body["verification_required"])
            self.assertIsNone(body["access_token"])
            self.assertEqual(len(sent), 1)
            self.assertTrue(sent[0][1].startswith("https://lms.example.com/verify-email?token="))

            blocked = await self.login("Secret123!")
            self.assertEqual(blocked.status_code, 403, blocked.text)
            self.assertEqual(blocked.json()["code"], "EMAIL_NOT_VERIFIED")
            # A wrong password must not reveal that the account exists but is unverified.
            wrong = await self.login("Wrong123!")
            self.assertEqual(wrong.status_code, 401)

        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            self.assertIsNone(user.email_verified_at)

    async def test_verify_email_enables_login_and_token_is_single_use(self):
        sent = []
        a, b, c = self.smtp_on(sent)
        with a, b, c:
            await self.register()
            token = self.token_of(sent)
            ok = await self.client.post("/api/auth/verify-email", json={"token": token})
            self.assertEqual(ok.status_code, 200, ok.text)
            self.assertEqual((await self.login("Secret123!")).status_code, 200)
            again = await self.client.post("/api/auth/verify-email", json={"token": token})
            self.assertEqual(again.status_code, 400)
            bad = await self.client.post("/api/auth/verify-email", json={"token": "x" * 40})
            self.assertEqual(bad.status_code, 400)

    async def test_expired_verification_token_is_rejected(self):
        from datetime import datetime, timezone

        sent = []
        a, b, c = self.smtp_on(sent)
        with a, b, c:
            await self.register()
            async with self.sessions() as db:
                row = (await db.execute(select(EmailVerificationToken))).scalar_one()
                row.expires_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
                await db.commit()
            res = await self.client.post("/api/auth/verify-email", json={"token": self.token_of(sent)})
            self.assertEqual(res.status_code, 400)
            self.assertEqual((await self.login("Secret123!")).status_code, 403)

    async def test_resend_replaces_old_link_and_does_not_enumerate(self):
        sent = []
        a, b, c = self.smtp_on(sent)
        with a, b, c:
            await self.register()
            first = self.token_of(sent)
            existing = await self.client.post(
                "/api/auth/resend-verification", json={"email": "student@gmail.com"}
            )
            missing = await self.client.post(
                "/api/auth/resend-verification", json={"email": "nobody@example.com"}
            )
            self.assertEqual(existing.status_code, 200)
            self.assertEqual(existing.json(), missing.json())
            self.assertEqual(len(sent), 2)  # nothing was sent to the unknown address
            second = self.token_of(sent)
            self.assertNotEqual(first, second)
            old = await self.client.post("/api/auth/verify-email", json={"token": first})
            self.assertEqual(old.status_code, 400)
            self.assertEqual(
                (await self.client.post("/api/auth/verify-email", json={"token": second})).status_code,
                200,
            )
            # Already verified: a further resend sends nothing.
            await self.client.post(
                "/api/auth/resend-verification", json={"email": "student@gmail.com"}
            )
            self.assertEqual(len(sent), 2)

    async def test_register_keeps_account_when_verification_mail_fails(self):
        with (
            patch.object(get_settings(), "smtp_host", "smtp.example.com"),
            patch(
                "app.services.email_verification.send_verification_email",
                side_effect=OSError("smtp down"),
            ),
        ):
            res = await self.register()
        self.assertEqual(res.status_code, 201, res.text)
        self.assertTrue(res.json()["verification_required"])
        self.assertFalse(res.json()["email_sent"])
        async with self.sessions() as db:
            self.assertEqual(len((await db.execute(select(User))).scalars().all()), 1)
            self.assertEqual(len((await db.execute(select(EmailVerificationToken))).scalars().all()), 1)

    async def test_without_smtp_register_is_verified_immediately(self):
        res = await self.register()
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.json()["verification_required"])
        self.assertTrue(res.json()["access_token"])
        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            self.assertIsNotNone(user.email_verified_at)

    async def test_unverified_account_can_log_in_when_smtp_is_off(self):
        await self.register()
        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            user.email_verified_at = None
            await db.commit()
        self.assertEqual((await self.login("Secret123!")).status_code, 200)

    async def test_legacy_verified_account_logs_in_with_smtp_on(self):
        await self.register()  # SMTP off: stored as verified, like backfilled accounts
        with patch.object(get_settings(), "smtp_host", "smtp.example.com"):
            self.assertEqual((await self.login("Secret123!")).status_code, 200)

    async def test_google_sign_in_marks_email_verified(self):
        with patch.object(get_settings(), "smtp_host", "smtp.example.com"):
            res = await self.google()
        self.assertEqual(res.status_code, 200, res.text)
        async with self.sessions() as db:
            user = (await db.execute(select(User))).scalar_one()
            self.assertIsNotNone(user.email_verified_at)

    async def test_password_reset_confirmation_marks_email_verified(self):
        sent = []
        a, b, c = self.smtp_on(sent)
        reset_urls = []

        async def fake_reset(to_email, url, ttl):
            reset_urls.append(url)

        with (
            a,
            b,
            c,
            patch("app.services.password_reset.send_password_reset_email", side_effect=fake_reset),
        ):
            await self.register()
            await self.client.post("/api/auth/forgot-password", json={"email": "student@gmail.com"})
            from urllib.parse import parse_qs, urlsplit

            token = parse_qs(urlsplit(reset_urls[0]).query)["token"][0]
            done = await self.client.post(
                "/api/auth/reset-password", json={"token": token, "new_password": "Newsecret123!"}
            )
            self.assertEqual(done.status_code, 200, done.text)
            self.assertEqual((await self.login("Newsecret123!")).status_code, 200)


class GoogleVerificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_config_missing(self):
        with patch.object(get_settings(), "google_client_id", ""):
            with self.assertRaises(Exception) as context:
                await verify_google_credential("bad")
        self.assertEqual(context.exception.status_code, 503)

    async def test_invalid_or_unverified_token(self):
        with patch.object(get_settings(), "google_client_id", "test-client"):
            for result in (
                ValueError("expired/wrong audience"),
                {
                    "sub": "123",
                    "email": "a@gmail.com",
                    "email_verified": False,
                    "iss": "accounts.google.com",
                },
            ):
                kwargs = (
                    {"side_effect": result}
                    if isinstance(result, Exception)
                    else {"return_value": result}
                )
                with patch("app.core.google_auth.id_token.verify_oauth2_token", **kwargs):
                    with self.assertRaises(Exception) as context:
                        await verify_google_credential("bad")
                    self.assertEqual(context.exception.status_code, 401)

    async def test_verifier_receives_server_audience(self):
        claims = {
            "sub": "123",
            "email": "a@gmail.com",
            "email_verified": True,
            "iss": "https://accounts.google.com",
        }
        with patch.object(get_settings(), "google_client_id", "server-client"):
            with patch(
                "app.core.google_auth.id_token.verify_oauth2_token", return_value=claims
            ) as verify:
                self.assertEqual(await verify_google_credential("signed"), claims)
                self.assertEqual(verify.call_args.args[2], "server-client")
                self.assertGreaterEqual(verify.call_args.kwargs.get("clock_skew_in_seconds", 0), 60)

    async def test_verifier_accepts_slightly_ahead_iat_with_clock_skew(self):
        from datetime import datetime, timezone

        from google.auth import jwt as google_jwt

        now = int(datetime.now(timezone.utc).timestamp())
        # Simulates Google issuing a token ~2 seconds ahead of a slightly slow local Windows clock.
        iat = now + 2
        with self.assertRaises(ValueError):
            google_jwt._verify_iat_and_exp({"iat": iat, "exp": iat + 3600}, clock_skew_in_seconds=0)
        # Does not raise when using our configured clock skew tolerance.
        google_jwt._verify_iat_and_exp({"iat": iat, "exp": iat + 3600}, clock_skew_in_seconds=60)

    async def test_invalid_issuer_returns_401(self):
        from google.auth.exceptions import GoogleAuthError

        with patch.object(get_settings(), "google_client_id", "server-client"):
            for result in (GoogleAuthError("Wrong issuer"), {"iss": "https://untrusted.example"}):
                kwargs = (
                    {"side_effect": result}
                    if isinstance(result, Exception)
                    else {"return_value": result}
                )
                with patch("app.core.google_auth.id_token.verify_oauth2_token", **kwargs):
                    with self.assertRaises(Exception) as context:
                        await verify_google_credential("bad")
                    self.assertEqual(context.exception.status_code, 401)


class ConsoleTests(unittest.TestCase):
    def test_windows_console_supports_vietnamese(self):
        output = io.BytesIO()
        stream = io.TextIOWrapper(output, encoding="cp1252")
        with patch("sys.stdout", stream), patch("sys.stderr", stream):
            configure_console_encoding()
            stream.write("Kết nối → localhost")
            stream.flush()
        self.assertEqual(output.getvalue().decode("utf-8"), "Kết nối → localhost")


if __name__ == "__main__":
    unittest.main()
