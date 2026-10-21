"""Verify the downloadable source catalog actually matches the pinned classroom examples."""

import json
import unittest
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace

import httpx
from fastapi import FastAPI

from app.routers import curriculum
from app.services.auth import get_current_user


class CurriculumTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
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
        self.assertEqual({item["id"] for item in actual}, {item["id"] for item in expected})
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
        response = await self.client.get(
            "/api/curriculum/exercises/Lab6-02_Watchdog_And_Event/source"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment;", response.headers["content-disposition"])
        self.assertIn("Lab6-02_Watchdog_And_Event.ino", response.headers["content-disposition"])
        self.assertIn("scheduler.enableWatchdog(10)", response.text)
        self.assertIn("std::sqrt(ax * ax + ay * ay + az * az)", response.text)
        metadata = next(
            item
            for item in curriculum.catalog()["exercises"]
            if item["id"] == "Lab6-02_Watchdog_And_Event"
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
