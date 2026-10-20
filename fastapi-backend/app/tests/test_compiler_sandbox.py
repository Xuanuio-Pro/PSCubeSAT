import asyncio
import base64
import json
import os
import sys
import tempfile
import unittest
from hashlib import sha256
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services import artifacts, compiler_svc
from app.services import compiler_sandbox as sandbox
from app.services.lab1 import get_template


def envelope(board="esp32"):
    config_hash = sha256(
        (
            sandbox._PIO_INI[board]
            + (
                Path(sandbox.__file__).resolve().parents[1] / "firmware/export_flash_manifest.py"
            ).read_text(encoding="utf-8")
        ).encode()
    ).hexdigest()
    return {
        "success": True,
        "chip": board,
        "mode": "dio",
        "frequency": "40m",
        "size": "4MB",
        "source_sha256": sha256(b"source").hexdigest(),
        "build_config_sha256": config_hash,
        "logs": "ok",
        "files": [
            {"name": name, "offset": offset, "data": base64.b64encode(name.encode()).decode()}
            for name, offset in [
                ("bootloader.bin", 4096),
                ("partitions.bin", 32768),
                ("boot_app0.bin", 57344),
                ("firmware.bin", 65536),
            ]
        ],
    }


class SandboxTests(unittest.IsolatedAsyncioTestCase):
    async def test_job_command_has_no_host_mount_network_or_privileges(self):
        cmd = sandbox.command("test-job")
        for flag in (
            "--network=none",
            "--read-only",
            "--user=65532:65532",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--pids-limit=128",
            "--memory=1536m",
        ):
            self.assertIn(flag, cmd)
        for forbidden in ("-v", "--volume", "--mount", "--env-file", "--privileged"):
            self.assertNotIn(forbidden, cmd)
        with patch.object(sandbox.shutil, "which", return_value=None):
            self.assertIsNone(await compiler_svc._find_pio())  # host pio cannot be a fallback

    async def test_untrusted_paths_and_offsets_are_rejected_before_write(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "build"
            for kind in ("path", "overlap", "oversize_offset", "duplicate", "chip", "base64"):
                data = envelope()
                if kind == "path":
                    data["files"][0]["name"] = "../secret"
                if kind == "overlap":
                    data["files"][1]["offset"] = 4096
                if kind == "oversize_offset":
                    data["files"][-1]["offset"] = 10**12
                if kind == "duplicate":
                    data["files"][0]["name"] = "firmware.bin"
                if kind == "chip":
                    data["chip"] = "esp32s3"
                if kind == "base64":
                    data["files"][0]["data"] = "??"
                with self.assertRaises(ValueError, msg=kind):
                    sandbox.materialize(data, "esp32", target)
                self.assertFalse(target.exists())

    async def test_worker_transport_materializes_files_and_always_removes_container(self):
        body = json.dumps(envelope())
        cmd = [sys.executable, "-c", "import sys; sys.stdin.read(); print(" + repr(body) + ")"]
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(sandbox, "command", return_value=cmd),
            patch.object(sandbox, "_remove", AsyncMock()) as remove,
        ):
            rc, logs = await sandbox.run("source", "esp32", Path(directory), 5)
            self.assertEqual((rc, logs), (0, "ok"))
            self.assertEqual((Path(directory) / "firmware.bin").read_bytes(), b"firmware.bin")
            remove.assert_awaited_once()

    async def test_timeout_cancel_and_output_limit_remove_container(self):
        for mode in ("timeout", "cancel", "overflow"):
            script = "import time; time.sleep(30)" if mode != "overflow" else "print('x'*10000)"
            with (
                tempfile.TemporaryDirectory() as directory,
                patch.object(sandbox, "command", return_value=[sys.executable, "-c", script]),
                patch.object(sandbox, "_remove", AsyncMock()) as remove,
                patch.object(sandbox, "MAX_OUTPUT", 1000),
            ):
                task = asyncio.create_task(
                    sandbox.run("code", "esp32", Path(directory), 0.15 if mode == "timeout" else 5)
                )
                if mode == "cancel":
                    await asyncio.sleep(0.1)
                    task.cancel()
                expected = {
                    "timeout": asyncio.TimeoutError,
                    "cancel": asyncio.CancelledError,
                    "overflow": ValueError,
                }[mode]
                with self.assertRaises(expected):
                    await task
                remove.assert_awaited_once()

    async def test_failed_build_cannot_materialize_old_files(self):
        body = json.dumps({"success": False, "logs": "bad source"})
        cmd = [sys.executable, "-c", "import sys; sys.stdin.read(); print(" + repr(body) + ")"]
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(sandbox, "command", return_value=cmd),
            patch.object(sandbox, "_remove", AsyncMock()),
        ):
            target = Path(directory) / "build"
            self.assertEqual(await sandbox.run("code", "esp32", target, 5), (1, "bad source"))
            self.assertFalse(target.exists())


@unittest.skipUnless(sys.platform == "win32", "Windows Uvicorn reload regression")
class WindowsSelectorSandboxTests(SandboxTests):
    """Repeat transport, timeout, cancellation and cleanup on Uvicorn's loop."""

    def _setupAsyncioRunner(self):
        self._asyncioRunner = asyncio.Runner(loop_factory=asyncio.SelectorEventLoop)


@unittest.skipUnless(
    os.getenv("PSCUBESAT_TEST_DOCKER") == "1", "Requires built compiler image and Docker Engine"
)
class SandboxIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_ptitcube_and_bundled_camera_on_both_boards(self):
        fixtures = Path(__file__).resolve().parents[1] / "firmware"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for board in ("esp32", "esp32s3"):
                for fixture in ("ptitcube_smoke.cpp", "camera_driver_smoke.cpp"):
                    with (
                        self.subTest(board=board, fixture=fixture),
                        patch.object(artifacts, "ARTIFACT_DIR", root / "artifacts"),
                        patch.object(
                            compiler_svc, "_BOARD_DIRS", {b: root / b for b in ("esp32", "esp32s3")}
                        ),
                    ):
                        source = (fixtures / fixture).read_text(encoding="utf-8")
                        result = await compiler_svc.compile_code(
                            source, board, owner_id=1, include_binary=False
                        )
                        self.assertTrue(
                            result["success"], result.get("logs", result.get("message"))
                        )
                        manifest = result["artifact"]
                        self.assertEqual(len(manifest["flash"]["files"]), 4)
                        for file in manifest["flash"]["files"]:
                            path, _ = artifacts.get_file(manifest["id"], file["name"], 1)
                            self.assertEqual(sha256(path.read_bytes()).hexdigest(), file["sha256"])

    async def test_two_real_boards_and_host_file_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "private-sentinel.h"
            marker.write_text("#error AUDIT_PRIVATE_SENTINEL_NOT_IN_REQUEST\n")
            for board in ("esp32", "esp32s3"):
                with (
                    patch.object(artifacts, "ARTIFACT_DIR", root / "artifacts"),
                    patch.object(
                        compiler_svc, "_BOARD_DIRS", {b: root / b for b in ("esp32", "esp32s3")}
                    ),
                ):
                    result = await compiler_svc.compile_code(
                        get_template(board)["code"],
                        board,
                        owner_id=1,
                        lab_id=1,
                        include_binary=False,
                    )
                    self.assertTrue(result["success"], result.get("logs", result.get("message")))
                    manifest = result["artifact"]
                    self.assertEqual(len(manifest["flash"]["files"]), 4)
                    for file in manifest["flash"]["files"]:
                        path, _ = artifacts.get_file(manifest["id"], file["name"], 1)
                        self.assertEqual(sha256(path.read_bytes()).hexdigest(), file["sha256"])
            rc, logs = await sandbox.run(
                '#include "' + marker.as_posix() + '"\nvoid setup(){}\nvoid loop(){}',
                "esp32",
                root / "denied",
                600,
            )
            self.assertNotEqual(rc, 0)
            self.assertNotIn("AUDIT_PRIVATE_SENTINEL_NOT_IN_REQUEST", logs)
