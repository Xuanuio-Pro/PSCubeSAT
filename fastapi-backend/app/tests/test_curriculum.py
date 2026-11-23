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
from app.routers import curriculum
from app.services.auth import get_current_user


class CurriculumTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # These tests cover the legacy (non-class) path; do not inherit LMS_CLASS_MODE from a local .env.
        lms_flag = patch.object(get_settings(), "lms_class_mode", False)
        lms_flag.start()
        self.addCleanup(lms_flag.stop)
        self.app = FastAPI()
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
        ]:
            response = await self.client.get(url)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.headers["www-authenticate"], "Bearer")
