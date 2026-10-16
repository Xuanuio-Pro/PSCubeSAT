"""Only fixed, secret-free Docker jobs may execute user C++.

No bind mounts, inherited environment, network, or Docker socket enter a job.
The API is a trusted orchestrator; the Docker daemon is part of that trust boundary.
"""
import asyncio
import base64
import json
import shutil
import uuid
from pathlib import Path
from hashlib import sha256

from app.core.config import get_settings
from app.core.subprocess_loop import run_with_subprocesses
from app.services.build_config import _PIO_INI

MAX_OUTPUT = 32 * 1024 * 1024
IMAGE_NAMES = {'bootloader.bin', 'partitions.bin', 'boot_app0.bin', 'firmware.bin'}


async def image_id() -> str | None:
    return await run_with_subprocesses(_image_id)


async def _image_id() -> str | None:
    docker = shutil.which('docker')
    if not docker:
        return None
    proc = await asyncio.create_subprocess_exec(docker, 'image', 'inspect',
        get_settings().compiler_image, '--format', '{{.Id}}',
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
    try:
        output, _ = await asyncio.wait_for(proc.communicate(), 10)
        return output.decode().strip() if proc.returncode == 0 else None
    except asyncio.TimeoutError:
        return None
    finally:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()


def command(name: str) -> list[str]:
    return [shutil.which('docker') or 'docker', 'run', '--rm', '-i', '--pull=never',
            '--name', name, '--network=none', '--read-only', '--user=65532:65532',
            '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128',
            '--memory=1536m', '--memory-swap=1536m', '--cpus=2',
            '--ulimit', 'nofile=256:256', '--log-driver=none',
            '--tmpfs', '/work:rw,exec,nosuid,size=768m,uid=65532,gid=65532,mode=700',
            '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m,uid=65532,gid=65532,mode=700',
            get_settings().compiler_image]


async def _remove(name: str) -> None:
    proc = await asyncio.create_subprocess_exec(
        shutil.which('docker') or 'docker', 'rm', '-f', name,
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    try:
        await asyncio.wait_for(proc.wait(), 15)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()


async def run(code: str, board: str, build_dir: Path, timeout: float) -> tuple[int, str]:
    return await run_with_subprocesses(_run, code, board, build_dir, timeout)


async def _run(code: str, board: str, build_dir: Path, timeout: float) -> tuple[int, str]:
    name = 'pscubesat-build-' + uuid.uuid4().hex
    proc = await asyncio.create_subprocess_exec(*command(name), stdin=asyncio.subprocess.PIPE,
                                              stdout=asyncio.subprocess.PIPE,
                                              stderr=asyncio.subprocess.PIPE)
    async def read_bounded(stream):
        chunks, size = [], 0
        while chunk := await stream.read(65536):
            size += len(chunk)
            if size > MAX_OUTPUT:
                raise ValueError('Sandbox output exceeds limit')
            chunks.append(chunk)
        return b''.join(chunks)

    async def exchange():
        async def send():
            proc.stdin.write(json.dumps({'code': code, 'board': board}).encode())
            await proc.stdin.drain()
            proc.stdin.close()
        tasks = [asyncio.create_task(send()), asyncio.create_task(read_bounded(proc.stdout)),
                 asyncio.create_task(read_bounded(proc.stderr))]
        try:
            _, output, errors = await asyncio.gather(*tasks)
            await proc.wait()
            return output, errors
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    try:
        output, errors = await asyncio.wait_for(exchange(), timeout)
        if proc.returncode:
            # Daemon errors may contain host details; keep them out of public logs.
            raise OSError('Compiler sandbox failed to start or exited unexpectedly')
        result = json.loads(output)
        logs = result.get('logs', '')[:1024 * 1024]
        if not result['success']:
            return 1, logs
        expected_config = sha256((_PIO_INI[board] + (Path(__file__).resolve().parents[1] /
            'firmware/export_flash_manifest.py').read_text(encoding='utf-8')).encode()).hexdigest()
        if result.get('source_sha256') != sha256(code.encode()).hexdigest() or result.get('build_config_sha256') != expected_config:
            raise ValueError('Compiler image configuration or source mismatch; rebuild image')
        materialize(result, board, build_dir)
        return 0, logs
    finally:
        # Killing docker CLI alone does not stop the container. Remove by server-owned name.
        try:
            await asyncio.shield(_remove(name))
        finally:
            if proc.returncode is None:
                proc.kill()
                await proc.wait()


def materialize(result: dict, board: str, build_dir: Path) -> None:
    """Validate the untrusted worker envelope before writing any host file."""
    images = result['files']
    if len(images) != 4 or {f['name'] for f in images} != IMAGE_NAMES:
        raise ValueError('Invalid image set')
    if result['chip'] != board or result['mode'] not in ('dio', 'qio', 'dout', 'qout'):
        raise ValueError('Invalid chip/mode')
    if result['frequency'] not in ('40m', '80m') or result['size'] not in ('4MB', '8MB'):
        raise ValueError('Invalid flash parameters')
    decoded = []
    end = 0
    for item in sorted(images, key=lambda f: f['offset']):
        data = base64.b64decode(item['data'], validate=True)
        offset = item['offset']
        if type(offset) is not int or offset < end or not 0 < len(data) <= 8 * 1024 * 1024:
            raise ValueError('Invalid image bounds')
        end = offset + len(data)
        if end > (8 if board == 'esp32s3' else 4) * 1024 * 1024:
            raise ValueError('Image exceeds board flash')
        decoded.append((item, data))
    build_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for item, data in decoded:
        path = build_dir / item['name']
        path.write_bytes(data)
        entries.append({'path': str(path), 'offset': item['offset']})
    manifest = {key: result[key] for key in ('chip', 'mode', 'frequency', 'size')}
    manifest['files'] = entries
    (build_dir / 'flash-manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
