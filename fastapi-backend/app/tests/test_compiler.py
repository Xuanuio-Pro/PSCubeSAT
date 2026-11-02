import asyncio
import base64
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.exceptions import register_exception_handlers
from app.db import get_db
from app.routers import compiler
from app.services import artifacts, compiler_svc
from app.services.auth import get_current_user
from app.services.lab1 import get_template


def fake_build(directory: Path, board: str, data: bytes = b"application"):
    directory.mkdir(parents=True, exist_ok=True)
    files = []
    for name, offset, contents in [
        ("bootloader.bin", 0 if board == "esp32s3" else 4096, b"bootloader"),
        ("partitions.bin", 32768, b"partitions"),
        ("boot_app0.bin", 57344, b"ota"),
        ("firmware.bin", 65536, data),
    ]:
        path = directory / name
        path.write_bytes(contents)
        files.append({"path": str(path), "offset": offset})
    (directory / "flash-manifest.json").write_text(
        json.dumps(
            {
                "chip": board,
                "mode": "dio",
                "frequency": "80m",
                "size": "4MB",
                "files": files,
            }
        ),
        encoding="utf-8",
    )


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.storage = patch.object(artifacts, "ARTIFACT_DIR", self.root / "artifacts")
        self.storage.start()
        self.addCleanup(self.storage.stop)
        self.build = self.root / "build"
        fake_build(self.build, "esp32")

    def create(self, owner=1):
        return artifacts.create_artifact(
            "esp32", "source\n", self.build, owner_id=owner, lab_id=1, config_sha256="config"
        )

    def test_snapshot_download_does_not_change_when_next_build_overwrites_cache(self):
        manifest = self.create()
        (self.build / "firmware.bin").write_bytes(b"another student's binary")
        path, entry = artifacts.get_file(manifest["id"], "firmware.bin", 1)
        self.assertEqual(path.read_bytes(), b"application")
        self.assertEqual(entry["sha256"], sha256(path.read_bytes()).hexdigest())
        self.assertEqual(manifest["source_sha256"], sha256(b"source\n").hexdigest())
        self.assertEqual(
            [f["offset"] for f in manifest["flash"]["files"]], [4096, 32768, 57344, 65536]
        )
        self.assertNotIn("_owner_id", manifest)

    def test_other_owner_anonymous_and_traversal_cannot_read_private_artifact(self):
        manifest = self.create()
        for user in [None, 2]:
            with self.assertRaises(artifacts.ArtifactNotFound):
                artifacts.get_artifact(manifest["id"], user)
        for name in ["../manifest.json", "manifest.json", "main.cpp", "C:\\secret"]:
            with self.assertRaises(artifacts.ArtifactNotFound):
                artifacts.get_file(manifest["id"], name, 1)
        with self.assertRaises(artifacts.ArtifactNotFound):
            artifacts.get_artifact("../../build", 1)
        public = self.create(owner=None)
        self.assertEqual(artifacts.get_artifact(public["id"], None)["id"], public["id"])

    def test_expired_artifact_is_inaccessible_and_cleanup_reclaims_storage(self):
        manifest = self.create()
        path = artifacts.ARTIFACT_DIR / manifest["id"] / "manifest.json"
        info = json.loads(path.read_text())
        info["expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        path.write_text(json.dumps(info))
        with self.assertRaises(artifacts.ArtifactExpired):
            artifacts.get_artifact(manifest["id"], 1)
        artifacts.cleanup_expired()
        self.assertFalse(path.parent.exists())

    def test_incomplete_and_overlapping_flash_sets_do_not_create_artifacts(self):
        path = self.build / "flash-manifest.json"
        raw = json.loads(path.read_text())
        raw["files"][1]["offset"] = 4096
        path.write_text(json.dumps(raw))
        with self.assertRaises(ValueError):
            self.create()
        self.assertEqual(list(artifacts.ARTIFACT_DIR.iterdir()), [])
        raw["files"] = raw["files"][-1:]
        path.write_text(json.dumps(raw))
        with self.assertRaises(ValueError):
            self.create()


class CompilerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.patches = [
            patch.object(artifacts, "ARTIFACT_DIR", self.root / "artifacts"),
            patch.object(
                compiler_svc, "_BOARD_DIRS", {b: self.root / b for b in ["esp32", "esp32s3"]}
            ),
            patch.object(compiler_svc, "_find_pio", AsyncMock(return_value=["sandbox"])),
        ]
        for item in self.patches:
            item.start()
        self.app = FastAPI()
        self.app.include_router(compiler.router)
        register_exception_handlers(self.app)
        self.user = SimpleNamespace(id=1)

        async def user():
            return self.user

        async def db():
            yield SimpleNamespace(rollback=AsyncMock())

        self.app.dependency_overrides[get_current_user] = user
        self.app.dependency_overrides[get_db] = db
        self.client = AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    async def build(self, args):
        board = args[args.index("-e") + 1]
        cache = Path(args[args.index("-d") + 1])
        code = (cache / "src" / "main.cpp").read_bytes()
        fake_build(cache / ".pio" / "build" / board, board, data=code)
        await asyncio.sleep(0.01)
        return 0, "build succeeded"

    async def test_compile_to_manifest_to_binary_and_owner_isolation(self):
        code = 'const char* host = "mqtt.ptit-stem-cube.local";\n'
        with patch.object(compiler_svc, "_run_build", side_effect=self.build):
            response = await self.client.post("/api/compile", json={"code": code, "board": "esp32"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(base64.b64decode(body["binBase64"]), code.encode())
        artifact = body["artifact"]
        manifest = await self.client.get(artifact["manifest_url"])
        self.assertEqual(manifest.json(), artifact)
        self.assertEqual(manifest.headers["cache-control"], "no-store")
        image = next(f for f in artifact["flash"]["files"] if f["name"] == "firmware.bin")
        downloaded = await self.client.get(image["download_url"])
        self.assertEqual(downloaded.content, code.encode())
        self.assertEqual(downloaded.headers["x-content-sha256"], image["sha256"])
        self.user = SimpleNamespace(id=2)
        self.assertEqual((await self.client.get(image["download_url"])).status_code, 404)
        self.user = None
        self.assertEqual((await self.client.get(artifact["manifest_url"])).status_code, 401)

    async def test_same_board_parallel_builds_keep_sources_and_artifacts_separate(self):
        with patch.object(compiler_svc, "_run_build", side_effect=self.build):
            a, b = await asyncio.gather(
                compiler_svc.compile_code("code A", "esp32", include_binary=False),
                compiler_svc.compile_code("code B", "esp32", include_binary=False),
            )
        self.assertNotIn("binBase64", a)
        self.assertNotEqual(a["artifact"]["id"], b["artifact"]["id"])
        for result, code in [(a, "code A"), (b, "code B")]:
            path, _ = artifacts.get_file(result["artifact"]["id"], "firmware.bin", None)
            self.assertEqual(path.read_text(), code)

    async def test_failure_does_not_return_a_previous_successful_artifact(self):
        with patch.object(compiler_svc, "_run_build", side_effect=self.build):
            self.assertTrue((await compiler_svc.compile_code("ok", "esp32"))["success"])
        with patch.object(compiler_svc, "_run_build", AsyncMock(return_value=(1, "syntax error"))):
            result = await compiler_svc.compile_code("invalid", "esp32")
        self.assertFalse(result["success"])
        self.assertEqual(result["error_code"], "BUILD_FAILED")
        self.assertNotIn("artifact", result)

    async def test_template_board_validation_and_progress_failure_preserve_artifact(self):
        for board in ["esp32", "esp32s3"]:
            response = await self.client.get("/api/labs/1/template", params={"board": board})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), get_template(board))
            self.assertNotIn("PTITCube.h", response.json()["code"])
        for payload in [
            {"code": " "},
            {"code": "x", "board": "other"},
            {"code": "x", "lab_id": 9},
            {"code": "é" * 140000},
        ]:
            self.assertEqual(
                (await self.client.post("/api/compile", json=payload)).status_code, 422
            )
        with (
            patch.object(compiler_svc, "_run_build", side_effect=self.build),
            patch.object(
                compiler.ProgressService,
                "mark_compiled",
                AsyncMock(side_effect=RuntimeError("database offline")),
            ),
        ):
            response = await self.client.post(
                "/api/compile", json={"code": "valid", "lab_id": 1, "include_binary": False}
            )
        self.assertTrue(response.json()["success"])
        self.assertFalse(response.json()["progress_saved"])
        self.assertIn("artifact", response.json())

    async def test_host_compiler_execution_is_disabled(self):
        with self.assertRaises(OSError):
            await compiler_svc._run_build([sys.executable, "-m", "platformio"])

    async def test_anonymous_compile_and_expired_download_status(self):
        self.user = None
        invalid = await self.client.post(
            "/api/compile", json={"code": "x"}, headers={"Authorization": "Bearer invalid"}
        )
        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(invalid.headers["www-authenticate"], "Bearer")
        with patch.object(compiler_svc, "_run_build", AsyncMock()) as worker:
            for path in ["/api/boards", "/api/labs/1/template"]:
                self.assertEqual((await self.client.get(path)).status_code, 401)
            guest = await self.client.post("/api/compile", json={"code": "x"})
            self.assertEqual(guest.status_code, 401)
            worker.assert_not_awaited()
        self.user = SimpleNamespace(id=1)
        with patch.object(compiler_svc, "_run_build", side_effect=self.build):
            response = await self.client.post(
                "/api/compile", json={"code": "x", "include_binary": False}
            )
        artifact = response.json()["artifact"]
        self.assertEqual((await self.client.get(artifact["manifest_url"])).status_code, 200)
        info_path = artifacts.ARTIFACT_DIR / artifact["id"] / "manifest.json"
        info = json.loads(info_path.read_text())
        info["expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        info_path.write_text(json.dumps(info))
        self.assertEqual((await self.client.get(artifact["manifest_url"])).status_code, 410)

    async def test_busy_cache_and_missing_compiler_are_reported(self):
        cache = compiler_svc._BOARD_DIRS["esp32"]
        cache.mkdir(parents=True)
        from filelock import FileLock

        with (
            FileLock(cache / ".compile.lock"),
            patch.object(compiler_svc, "QUEUE_TIMEOUT_SECONDS", 0),
        ):
            result = await compiler_svc.compile_code("x", "esp32")
        self.assertEqual(result["error_code"], "COMPILER_BUSY")
        with patch.object(compiler_svc, "_find_pio", AsyncMock(return_value=None)):
            result = await compiler_svc.compile_code("x", "esp32")
        self.assertFalse(result["compilerInstalled"])

    async def test_admission_queue_is_bounded_across_boards(self):
        from filelock import FileLock

        locks = [FileLock(self.root / f".compiler-slot-{index}") for index in range(4)]
        try:
            for lock in locks:
                lock.acquire(timeout=0)
            with patch.object(compiler_svc, "_run_build", AsyncMock()) as build:
                result = await compiler_svc.compile_code("code", "esp32")
                self.assertEqual(result["error_code"], "COMPILER_BUSY")
                build.assert_not_awaited()
        finally:
            for lock in locks:
                lock.release()
