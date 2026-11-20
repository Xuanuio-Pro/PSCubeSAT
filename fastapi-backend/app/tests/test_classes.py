"""Real auth and API permissions against a database, not dependency overrides."""

import re
import unittest
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient
from sqlalchemy import JSON, Integer, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.application import create_app
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, hash_password
from app.db import get_db
from app.models.tables import (
    AuditLog,
    Base,
    ClassMembership,
    Classroom,
    GoogleIdentity,
    PasswordResetToken,
    RevokedToken,
    User,
)
from app.schemas.classes import ClassCreate


class ClassPolicyTests(unittest.TestCase):
    def test_flag_default_and_normalization(self):
        self.assertFalse(Settings(_env_file=None).lms_class_mode)
        self.assertEqual(ClassCreate(code=" abc-1 ", name=" Lớp A ").code, "ABC-1")


class ClassAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        tables = [
            User.__table__,
            GoogleIdentity.__table__,
            RevokedToken.__table__,
            Classroom.__table__,
            ClassMembership.__table__,
            AuditLog.__table__,
            PasswordResetToken.__table__,
        ]
        self.original_types = []
        for table in (
            User.__table__,
            Classroom.__table__,
            ClassMembership.__table__,
            AuditLog.__table__,
        ):
            column = table.c.id
            self.original_types.append((column, column.type))
            column.type = column.type.with_variant(Integer(), "sqlite")
        for column in (AuditLog.__table__.c.before, AuditLog.__table__.c.after):
            self.original_types.append((column, column.type))
            column.type = column.type.with_variant(JSON(), "sqlite")
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
        await self.setup_client()

    async def setup_client(self):
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.app = create_app()

        async def test_db():
            async with self.sessions() as db:
                yield db

        self.app.dependency_overrides[get_db] = test_db
        self.redis_patch = patch("app.services.auth.get_redis", return_value=None)
        self.redis_patch.start()
        self.flag_patch = patch.object(get_settings(), "lms_class_mode", True)
        self.flag_patch.start()
        self.client = AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")
        async with self.sessions() as db:
            password = hash_password("secret123")
            for uid, role in ((1, "admin"), (2, "teacher"), (3, "teacher"), (4, "user")):
                db.add(
                    User(
                        id=uid,
                        email=f"user{uid}@example.com",
                        full_name=f"Người dùng {uid}",
                        password_hash=password,
                        role=role,
                    )
                )
            await db.commit()
        self.tokens = {
            uid: create_access_token({"sub": str(uid), "role": "admin"}) for uid in range(1, 5)
        }
        # Deliberately misleading claims: authorization must use persisted roles.
        self.class_a = (
            await self.call(
                2,
                "POST",
                "/api/classes",
                {
                    "code": "A",
                    "name": "Lớp A",
                    "status": "active",
                },
            )
        ).json()["id"]
        self.class_b = (
            await self.call(
                3,
                "POST",
                "/api/classes",
                {
                    "code": "B",
                    "name": "Lớp B",
                    "status": "active",
                },
            )
        ).json()["id"]

    async def asyncTearDown(self):
        await self.client.aclose()
        self.redis_patch.stop()
        self.flag_patch.stop()
        await self.engine.dispose()
        for column, original in self.original_types:
            column.type = original

    async def call(self, uid, method, path, body=None):
        return await self.client.request(
            method, path, json=body, headers={"Authorization": f"Bearer {self.tokens[uid]}"}
        )

    async def add_student(self):
        response = await self.call(
            2, "POST", f"/api/classes/{self.class_a}/members", {"email": " USER4@example.com "}
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def test_register_rejects_role_and_status(self):
        for extra in ({"role": "admin"}, {"role": "teacher"}, {"status": "active"}):
            result = await self.client.post(
                "/api/auth/register",
                json={
                    "email": "new@example.com",
                    "password": "Secret123!",
                    **extra,
                },
            )
            self.assertEqual(result.status_code, 422)
        result = await self.client.post(
            "/api/auth/register",
            json={
                "email": "new@example.com",
                "password": "Secret123!",
            },
        )
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()["user"]["role"], "user")

    async def test_teacher_cannot_read_or_write_another_class(self):
        base = f"/api/classes/{self.class_b}"
        for method, url, body in [
            ("GET", base, None),
            ("PATCH", base, {"name": "Hacked"}),
            ("DELETE", base, None),
            ("GET", base + "/members", None),
            ("POST", base + "/members", {"email": "user4@example.com"}),
            ("DELETE", base + "/members", {"user_id": 4}),
        ]:
            result = await self.call(2, method, url, body)
            self.assertEqual(result.status_code, 403, result.text)
            self.assertEqual(result.json()["code"], "MEMBERSHIP_REQUIRED")
        listed = (await self.call(2, "GET", "/api/classes")).json()
        self.assertEqual([row["id"] for row in listed["items"]], [self.class_a])

    async def test_membership_idempotency_removal_old_token_and_restore(self):
        first = await self.add_student()
        second = await self.add_student()
        self.assertEqual(first, second)
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{self.class_a}")).status_code, 200
        )
        for _ in range(2):
            result = await self.call(
                2, "DELETE", f"/api/classes/{self.class_a}/members", {"user_id": 4}
            )
            self.assertEqual(result.status_code, 204, result.text)
        result = await self.call(4, "GET", f"/api/classes/{self.class_a}")
        self.assertEqual(result.status_code, 403)
        self.assertEqual((await self.call(4, "GET", "/api/classes")).json()["items"], [])
        async with self.sessions() as db:
            row = (
                await db.execute(select(ClassMembership).where(ClassMembership.user_id == 4))
            ).scalar_one()
            self.assertEqual(row.status, "removed")
            self.assertIsNotNone(row.removed_at)
        restored = await self.add_student()
        self.assertEqual(restored["id"], first["id"])
        self.assertIsNone(restored["removed_at"])
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{self.class_a}")).status_code, 200
        )
        async with self.sessions() as db:
            count = (
                await db.execute(
                    select(func.count())
                    .select_from(ClassMembership)
                    .where(
                        ClassMembership.user_id == 4,
                    )
                )
            ).scalar_one()
            self.assertEqual(count, 1)

    async def test_locked_user_rejected_by_all_authenticated_http_routes(self):
        await self.add_student()
        result = await self.call(1, "PATCH", "/api/admin/users", {"user_id": 4, "status": "locked"})
        self.assertEqual(result.status_code, 200, result.text)
        public = {
            "/",
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/google",
            "/api/auth/google/config",
            "/api/auth/password-reset/config",
            "/api/auth/forgot-password",
            "/api/auth/reset-password/validate",
            "/api/auth/reset-password",
            "/api/auth/verify-email",
            "/api/auth/resend-verification",
            "/api/admin/signup",
            "/api/admin/login",
            "/api/curriculum/preview",
        }
        tested = []
        routes = []
        pending = list(self.app.routes)
        while pending:
            route = pending.pop()
            original_router = getattr(route, "original_router", None)
            if original_router is not None:
                pending.extend(original_router.routes)
            else:
                routes.append(route)
        for route in routes:
            if (
                not hasattr(route, "dependant")
                or not hasattr(route, "methods")
                or route.path in public
            ):
                continue
            path = re.sub(r"\{[^}]+\}", "1", route.path)
            for method in route.methods:
                result = await self.call(4, method, path, {})
                self.assertEqual(result.status_code, 401, f"{method} {path}: {result.text}")
                tested.append((method, path))
        self.assertGreater(len(tested), 25)
        result = await self.client.post(
            "/api/auth/login", json={"email": "user4@example.com", "password": "secret123"}
        )
        self.assertEqual(result.status_code, 401)
        await self.call(1, "PATCH", "/api/admin/users/4", {"status": "active"})
        self.assertEqual((await self.call(4, "GET", "/api/auth/me")).status_code, 200)

    async def test_google_and_socket_reject_locked_account(self):
        await self.call(1, "PATCH", "/api/admin/users/4", {"status": "locked"})
        claims = {"sub": "g4", "email": "user4@example.com", "hd": "example.com"}
        with patch("app.routers.auth.verify_google_credential", AsyncMock(return_value=claims)):
            self.assertEqual(
                (await self.client.post("/api/auth/google", json={"credential": "x"})).status_code,
                401,
            )
        from app.websocket.routes import authorize_telemetry_socket

        with patch("app.db.database.get_session_maker", return_value=self.sessions):
            self.assertFalse(await authorize_telemetry_socket(self.tokens[4], "any-device"))

    async def test_role_claim_cannot_grant_admin_and_demotion_is_immediate(self):
        self.assertEqual((await self.call(4, "GET", "/api/admin/users")).status_code, 403)
        self.assertEqual(
            (await self.call(2, "PATCH", "/api/admin/users/4", {"role": "teacher"})).status_code,
            403,
        )
        result = await self.call(1, "PATCH", "/api/admin/users", {"user_id": 2, "role": "user"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            (
                await self.call(2, "PATCH", f"/api/classes/{self.class_a}", {"name": "Bad"})
            ).status_code,
            403,
        )
        self.assertEqual(
            (await self.call(2, "GET", f"/api/classes/{self.class_a}")).status_code, 403
        )
        self.assertEqual((await self.call(2, "GET", "/api/classes")).json()["items"], [])
        await self.call(1, "PATCH", "/api/admin/users/2", {"role": "teacher"})
        self.assertEqual(
            (await self.call(2, "GET", f"/api/classes/{self.class_a}")).status_code, 200
        )

    async def test_admin_filters_pagination_and_audit(self):
        await self.call(1, "PATCH", "/api/admin/users/4", {"role": "teacher", "status": "locked"})
        result = (
            await self.call(
                1, "GET", "/api/admin/users?search=USER4&role=teacher&status=locked&page_size=1"
            )
        ).json()
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["id"], 4)
        self.assertNotIn("password_hash", str(result))
        self.assertEqual(
            (await self.call(1, "GET", "/api/admin/users?page_size=101")).status_code, 422
        )
        async with self.sessions() as db:
            log = (
                await db.execute(select(AuditLog).where(AuditLog.action == "user.update"))
            ).scalar_one()
            self.assertEqual(log.actor, 1)
            self.assertEqual(log.target, "user:4")
            self.assertEqual(log.before, {"role": "user", "status": "active"})
            self.assertEqual(log.after, {"role": "teacher", "status": "locked"})

    async def test_admin_resets_forgotten_password(self):
        url = "/api/admin/users/4/reset-password"
        for uid in (2, 4):
            self.assertEqual((await self.call(uid, "POST", url)).status_code, 403)
        self.assertEqual((await self.client.post(url)).status_code, 401)
        # Own account and other admins are never reset through this endpoint.
        await self.call(1, "PATCH", "/api/admin/users/3", {"role": "admin"})
        for uid in (1, 3):
            result = await self.call(1, "POST", f"/api/admin/users/{uid}/reset-password")
            self.assertEqual(result.status_code, 403, result.text)
            self.assertEqual(result.json()["code"], "FORBIDDEN_ROLE")
        self.assertEqual(
            (await self.call(1, "POST", "/api/admin/users/99/reset-password")).status_code, 404
        )

        result = await self.call(1, "POST", url)
        self.assertEqual(result.status_code, 200, result.text)
        temporary = result.json()["temporary_password"]
        self.assertGreaterEqual(len(temporary), 12)

        async def login(password):
            return await self.client.post(
                "/api/auth/login", json={"email": "user4@example.com", "password": password}
            )

        self.assertEqual((await login("secret123")).status_code, 401)
        self.assertEqual((await login(temporary)).status_code, 200)
        async with self.sessions() as db:
            log = (
                await db.execute(select(AuditLog).where(AuditLog.action == "user.password_reset"))
            ).scalar_one()
            self.assertEqual((log.actor, log.target), (1, "user:4"))
            self.assertNotIn(temporary, f"{log.before}{log.after}")

    async def test_admin_pending_reset_queue_and_one_time_reset_link(self):
        from urllib.parse import parse_qs, urlsplit

        link_url = "/api/admin/users/4/reset-link"
        for uid in (2, 4):
            self.assertEqual((await self.call(uid, "POST", link_url)).status_code, 403)
        self.assertEqual((await self.client.post(link_url)).status_code, 401)
        await self.call(1, "PATCH", "/api/admin/users/3", {"role": "admin"})
        for uid in (1, 3):
            self.assertEqual(
                (await self.call(1, "POST", f"/api/admin/users/{uid}/reset-link")).status_code, 403
            )

        forgot = await self.client.post(
            "/api/auth/forgot-password", json={"email": "user4@example.com"}
        )
        self.assertEqual(forgot.status_code, 200)
        queued = await self.call(1, "GET", "/api/admin/users?pending_reset=true")
        self.assertEqual(queued.status_code, 200, queued.text)
        self.assertEqual(queued.json()["total"], 1)
        self.assertEqual(queued.json()["items"][0]["id"], 4)
        self.assertTrue(queued.json()["items"][0]["pending_password_reset"])
        self.assertIsNotNone(queued.json()["items"][0]["reset_requested_at"])

        issued = await self.call(1, "POST", link_url)
        self.assertEqual(issued.status_code, 200, issued.text)
        body = issued.json()
        self.assertEqual(body["email"], "user4@example.com")
        self.assertTrue(body["reset_path"].startswith("/reset-password?token="))
        raw_token = parse_qs(urlsplit(body["reset_path"]).query)["token"][0]

        after_issue = await self.call(1, "GET", "/api/admin/users?pending_reset=true")
        self.assertEqual(after_issue.json()["total"], 0)

        done = await self.client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "Newpass123!"},
        )
        self.assertEqual(done.status_code, 200, done.text)
        self.assertEqual(
            (
                await self.client.post(
                    "/api/auth/login", json={"email": "user4@example.com", "password": "Newpass123!"}
                )
            ).status_code,
            200,
        )
        async with self.sessions() as db:
            log = (
                await db.execute(
                    select(AuditLog).where(AuditLog.action == "user.password_reset_link")
                )
            ).scalar_one()
            self.assertEqual((log.actor, log.target), (1, "user:4"))
            self.assertNotIn(raw_token, f"{log.before}{log.after}")

    async def test_student_cannot_manage_or_list_other_students(self):
        await self.add_student()
        for method, url, body in [
            ("POST", "/api/classes", {"code": "S", "name": "Bad"}),
            ("GET", f"/api/classes/{self.class_a}/members", None),
            ("POST", f"/api/classes/{self.class_a}/members", {"email": "user3@example.com"}),
        ]:
            self.assertEqual((await self.call(4, method, url, body)).status_code, 403)

    async def test_draft_archive_and_unique_code(self):
        result = await self.call(2, "POST", "/api/classes", {"code": " a ", "name": "Duplicate"})
        self.assertEqual(result.status_code, 409, result.text)
        draft = (await self.call(2, "POST", "/api/classes", {"code": "D", "name": "Draft"})).json()[
            "id"
        ]
        await self.call(2, "POST", f"/api/classes/{draft}/members", {"email": "user4@example.com"})
        self.assertEqual((await self.call(4, "GET", f"/api/classes/{draft}")).status_code, 403)
        await self.call(2, "PATCH", f"/api/classes/{draft}", {"status": "active", "name": "Open"})
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{draft}")).json()["name"], "Open"
        )
        await self.call(2, "DELETE", f"/api/classes/{draft}")
        self.assertEqual(
            (await self.call(4, "GET", f"/api/classes/{draft}")).json()["status"], "archived"
        )
        self.assertEqual(
            (
                await self.call(2, "DELETE", f"/api/classes/{draft}/members", {"user_id": 4})
            ).status_code,
            409,
        )

    async def test_admin_creation_and_protected_admin(self):
        invalid = await self.call(1, "POST", "/api/classes", {"code": "ADM", "name": "Admin class"})
        self.assertEqual(invalid.status_code, 422)
        created = await self.call(
            1, "POST", "/api/classes", {"code": "ADM", "name": "Admin class", "teacher_id": 2}
        )
        self.assertEqual(created.status_code, 201)
        for payload in ({"status": "locked"}, {"role": "user"}):
            self.assertEqual(
                (await self.call(1, "PATCH", "/api/admin/users/1", payload)).status_code, 403
            )
        promoted = await self.call(1, "PATCH", "/api/admin/users/4", {"role": "admin"})
        self.assertEqual(promoted.status_code, 200, promoted.text)
        self.assertEqual(promoted.json()["role"], "admin")

    async def test_admin_soft_deletes_student_and_closes_sessions_and_memberships(self):
        await self.add_student()
        self.assertEqual((await self.call(4, "GET", "/api/boards")).status_code, 200)
        deleted = await self.call(1, "DELETE", "/api/admin/users/4")
        self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertEqual(deleted.json(), {"user_id": 4, "deleted": True})
        # Existing sessions stop working at once and the account leaves the admin list.
        self.assertEqual((await self.call(4, "GET", "/api/boards")).status_code, 401)
        listed = (await self.call(1, "GET", "/api/admin/users")).json()["items"]
        self.assertNotIn(4, [row["id"] for row in listed])
        async with self.sessions() as db:
            user = await db.get(User, 4)
            self.assertIsNotNone(user.deleted_at)  # kept, not hard-deleted
            self.assertEqual(user.status, "locked")
            memberships = (
                await db.execute(
                    select(ClassMembership).where(ClassMembership.user_id == 4)
                )
            ).scalars().all()
            self.assertTrue(memberships)
            self.assertTrue(all(m.status == "removed" and m.removed_at for m in memberships))
            logs = (
                await db.execute(select(AuditLog).where(AuditLog.action == "user.delete"))
            ).scalars().all()
            self.assertEqual(len(logs), 1)
            self.assertEqual(logs[0].target, "user:4")
        self.assertEqual((await self.call(1, "DELETE", "/api/admin/users/4")).status_code, 404)

    async def test_delete_user_is_admin_only_and_protects_admins_self_and_teachers(self):
        self.assertEqual((await self.call(2, "DELETE", "/api/admin/users/4")).status_code, 403)
        self.assertEqual((await self.call(4, "DELETE", "/api/admin/users/4")).status_code, 403)
        self.assertEqual((await self.call(1, "DELETE", "/api/admin/users/1")).status_code, 403)
        promoted = await self.call(1, "PATCH", "/api/admin/users/4", {"role": "admin"})
        self.assertEqual(promoted.status_code, 200, promoted.text)
        self.assertEqual((await self.call(1, "DELETE", "/api/admin/users/4")).status_code, 403)
        # Teacher 2 still runs the active class A: refuse and name the class.
        blocked = await self.call(1, "DELETE", "/api/admin/users/2")
        self.assertEqual(blocked.status_code, 409, blocked.text)
        self.assertEqual(blocked.json()["details"]["classes"], ["A"])
        archived = await self.call(
            2, "PATCH", f"/api/classes/{self.class_a}", {"status": "archived"}
        )
        self.assertEqual(archived.status_code, 200, archived.text)
        self.assertEqual((await self.call(1, "DELETE", "/api/admin/users/2")).status_code, 200)

    async def test_flag_off_hides_new_apis_but_still_locks_accounts(self):
        await self.call(1, "PATCH", "/api/admin/users/4", {"status": "locked"})
        with patch.object(get_settings(), "lms_class_mode", False):
            self.assertEqual(
                (await self.call(1, "GET", "/api/lms/config")).json(),
                {"class_mode": False, "legacy_allowed": True},
            )
            self.assertEqual((await self.call(1, "GET", "/api/classes")).status_code, 404)
            self.assertEqual((await self.call(1, "GET", "/api/admin/users")).status_code, 200)
            self.assertEqual((await self.call(2, "GET", "/api/admin/users")).status_code, 403)
            self.assertEqual(
                (await self.call(1, "POST", "/api/admin/users/4/reset-link")).status_code, 200
            )
            self.assertEqual(
                (await self.call(1, "POST", "/api/admin/users/4/reset-password")).status_code, 200
            )
            self.assertEqual((await self.call(4, "GET", "/api/boards")).status_code, 401)

    async def test_student_import_csv_xlsx_templates_and_permissions(self):
        import base64
        from pathlib import Path

        from app.services.student_import import (
            parse_student_rows,
            student_template_csv,
            student_template_xlsx,
        )

        # Verify template endpoints & static template files
        self.assertEqual(
            (await self.call(4, "GET", "/api/classes/templates/students")).status_code, 403
        )
        csv_tpl = await self.call(2, "GET", "/api/classes/templates/students?format=csv")
        self.assertEqual(csv_tpl.status_code, 200)
        self.assertIn("email,full_name", csv_tpl.text)
        xlsx_tpl = await self.call(2, "GET", "/api/classes/templates/students?format=xlsx")
        self.assertEqual(xlsx_tpl.status_code, 200)
        self.assertEqual(
            len(parse_student_rows("xlsx", base64.b64encode(xlsx_tpl.content).decode())), 2
        )

        root = Path(__file__).resolve().parents[3]
        self.assertEqual(
            (root / "public/templates/class-students.csv").read_bytes(),
            student_template_csv().encode("utf-8"),
        )
        self.assertEqual(
            len(
                parse_student_rows(
                    "xlsx",
                    base64.b64encode(
                        (root / "public/templates/class-students.xlsx").read_bytes()
                    ).decode(),
                )
            ),
            2,
        )
        self.assertEqual(len(student_template_xlsx()), len(xlsx_tpl.content))

        # Add extra users for import testing: uid 5 (active), uid 6 (removed to restore), uid 7 (locked)
        async with self.sessions() as db:
            password = hash_password("secret123")
            for uid, status in ((5, "active"), (6, "active"), (7, "locked")):
                db.add(
                    User(
                        id=uid,
                        email=f"user{uid}@example.com",
                        full_name=f"Sinh viên {uid}",
                        password_hash=password,
                        role="user",
                        status=status,
                    )
                )
            await db.commit()
        await self.add_student()  # user4 already active
        await self.call(
            2, "POST", f"/api/classes/{self.class_a}/members", {"email": "user6@example.com"}
        )
        await self.call(2, "DELETE", f"/api/classes/{self.class_a}/members", {"user_id": 6})

        # Unauthorized teacher or student cannot import
        self.assertEqual(
            (
                await self.call(
                    2,
                    "POST",
                    f"/api/classes/{self.class_b}/members/import",
                    {"format": "csv", "content": "email\nuser5@example.com\n"},
                )
            ).status_code,
            403,
        )
        self.assertEqual(
            (
                await self.call(
                    4,
                    "POST",
                    f"/api/classes/{self.class_a}/members/import",
                    {"format": "csv", "content": "email\nuser5@example.com\n"},
                )
            ).status_code,
            403,
        )

        # CSV import with mixed valid and skipped rows
        csv_content = (
            "email,full_name\n"
            "USER5@example.com,Sinh viên 5\n"
            "user6@example.com,Sinh viên 6\n"
            "user4@example.com,Sinh viên 4\n"
            "user5@example.com,Trùng trong file\n"
            "missing@example.com,Chưa đăng ký\n"
            "user7@example.com,Bị khóa\n"
            "user2@example.com,Giảng viên lớp\n"
            "not-an-email,Sai định dạng\n"
            ",Thiếu email\n"
        )
        res = await self.call(
            2,
            "POST",
            f"/api/classes/{self.class_a}/members/import",
            {"format": "csv", "content": csv_content},
        )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(body["total_rows"], 9)
        self.assertEqual(body["added_count"], 1)
        self.assertEqual(body["restored_count"], 1)
        self.assertEqual(body["already_active_count"], 1)
        self.assertEqual(body["skipped_count"], 6)
        self.assertEqual(
            [item["code"] for item in body["skipped"]],
            [
                "DUPLICATE_IN_FILE",
                "NOT_REGISTERED",
                "ACCOUNT_LOCKED",
                "IS_TEACHER",
                "INVALID_EMAIL",
                "EMPTY_EMAIL",
            ],
        )

        # Excel (.xlsx) import test: remove user5 first, then re-import via .xlsx
        await self.call(2, "DELETE", f"/api/classes/{self.class_a}/members", {"user_id": 5})
        import io
        import zipfile

        xlsx_buf = io.BytesIO()
        with zipfile.ZipFile(xlsx_buf, "w") as zf:
            zf.writestr(
                "xl/sharedStrings.xml",
                '<?xml version="1.0" encoding="UTF-8"?>'
                "<sst><si><t>Email</t></si><si><t>Họ tên</t></si>"
                "<si><t>user5@example.com</t></si><si><t>Sinh viên 5</t></si>"
                "<si><t>unknown@gmail.com</t></si></sst>",
            )
            zf.writestr(
                "xl/worksheets/sheet1.xml",
                '<?xml version="1.0" encoding="UTF-8"?>'
                "<worksheet><sheetData>"
                '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
                '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>'
                '<row r="3"><c r="A3" t="s"><v>4</v></c></row>'
                "</sheetData></worksheet>",
            )
        xlsx_b64 = base64.b64encode(xlsx_buf.getvalue()).decode()
        xlsx_res = await self.call(
            2,
            "POST",
            f"/api/classes/{self.class_a}/members/import",
            {"format": "xlsx", "content": xlsx_b64},
        )
        self.assertEqual(xlsx_res.status_code, 200, xlsx_res.text)
        self.assertEqual(xlsx_res.json()["restored_count"], 1)
        self.assertEqual(xlsx_res.json()["skipped_count"], 1)
        self.assertEqual(xlsx_res.json()["skipped"][0]["code"], "NOT_REGISTERED")

        # Invalid headers & corrupt xlsx rejected with 422 CONFIG_INVALID
        bad_header = await self.call(
            2,
            "POST",
            f"/api/classes/{self.class_a}/members/import",
            {"format": "csv", "content": "username,name\nabc,Test\n"},
        )
        self.assertEqual(bad_header.status_code, 422)
        self.assertEqual(bad_header.json()["code"], "CONFIG_INVALID")

        bad_xlsx = await self.call(
            2,
            "POST",
            f"/api/classes/{self.class_a}/members/import",
            {"format": "xlsx", "content": base64.b64encode(b"not-a-zip").decode()},
        )
        self.assertEqual(bad_xlsx.status_code, 422)
        self.assertEqual(bad_xlsx.json()["code"], "CONFIG_INVALID")
