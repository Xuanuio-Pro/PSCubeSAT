"""Container entrypoint. Its image contains tools and trusted templates, never BE secrets."""
import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import signal
from hashlib import sha256

from build_config import _PIO_INI

ROOT = Path('/opt/compiler')
LIMIT = 1024 * 1024




def build():
    raw = sys.stdin.buffer.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('Request too large')
    request = json.loads(raw)
    board, code = request['board'], request['code']
    if board not in _PIO_INI or not isinstance(code, str) or not 0 < len(code.encode()) <= 262144:
        raise ValueError('Invalid build request')
    core = Path('/work/pio')
    core.mkdir()
    for name in ('packages', 'platforms'):
        (core / name).symlink_to(Path('/opt/platformio') / name, target_is_directory=True)
    project = Path('/work/project')
    shutil.copytree(Path('/opt/projects') / board, project)
    (project / 'src/main.cpp').write_bytes(code.encode('utf-8'))
    proc = subprocess.Popen(['pio', 'run', '-j', '2', '-d', str(project), '-e', board],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    chunks, size = [], 0
    while chunk := proc.stdout.read(16384):
        size += len(chunk)
        if size > LIMIT:
            proc.kill()
            proc.wait()
            return {'success': False, 'logs': 'Build output exceeded 1 MiB limit.'}
        chunks.append(chunk)
    logs = b''.join(chunks).decode('utf-8', errors='replace')
    if proc.wait():
        return {'success': False, 'logs': logs}
    manifest = json.loads((project / '.pio/build' / board / 'flash-manifest.json').read_text())
    files = []
    for entry in manifest.pop('files'):
        path = Path(entry['path'])
        files.append({'name': path.name, 'offset': entry['offset'],
                      'data': base64.b64encode(path.read_bytes()).decode('ascii')})
    config_hash = sha256((_PIO_INI[board] + (ROOT / 'export_flash_manifest.py').read_text()).encode()).hexdigest()
    return {'success': True, 'logs': logs, 'files': files,
            'source_sha256': sha256(code.encode()).hexdigest(), 'build_config_sha256': config_hash, **manifest}


if __name__ == '__main__':
    # Also bound lifetime when the API process dies before removing the job.
    signal.alarm(600)
    try:
        result = build()
    except Exception as exc:
        result = {'success': False, 'logs': 'Build worker failed: ' + type(exc).__name__}
    print(json.dumps(result))
