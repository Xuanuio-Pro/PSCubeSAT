"""Compile generated Blockly fixtures in the existing isolated sandbox; never flash.

First run node scripts/blockly-smoke.mjs from the repository root.
Then run this script with the backend Python environment.
"""
import asyncio
from hashlib import sha256
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'fastapi-backend'))
from app.services.compiler_sandbox import run


async def main():
    folder = ROOT / 'scratch/blockly-smoke'
    results = []
    names = ['default', 'all-blocks', 'all-blocks-roundtrip'] if '--bidir' in sys.argv else [*[f'lab{i}' for i in range(1, 9)], 'all-blocks', 'all-blocks-roundtrip', 'default']
    result_file = folder / ('bidir-results.json' if '--bidir' in sys.argv else 'matrix-results.json')
    for chip in ('esp32', 'esp32s3'):
        for name in names:
            source = (folder / f'{name}.cpp').read_text(encoding='utf-8')
            target = folder / f'{name}-{chip}'
            print(f'BUILD {name} {chip}', flush=True)
            status, log = await run(source, chip, target, 600)
            (folder / f'{name}-{chip}.log').write_text(log, encoding='utf-8')
            results.append({'fixture': name, 'chip': chip, 'status': status,
                            'source_sha256': sha256(source.encode()).hexdigest()})
            result_file.write_text(json.dumps(results, indent=2), encoding='utf-8')
            print(f'{"PASS" if status == 0 else "FAIL"} {name} {chip}', flush=True)
    return int(any(row['status'] != 0 for row in results))


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
