// Use the project's Python on Windows and Linux without embedding a user's path.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const relative = process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python'];
const candidates = [
  join(root, '.venv', ...relative),
  join(root, 'fastapi-backend', '.venv', ...relative),
  ...(process.env.CONDA_PREFIX ? [join(process.env.CONDA_PREFIX, process.platform === 'win32' ? 'python.exe' : 'bin/python')] : []),
  ...(process.platform === 'win32' ? [join(homedir(), 'miniconda3', 'envs', 'stemcube', 'python.exe')] : []),
];
const executable = process.env.PSCUBESAT_PYTHON || candidates.find(path => existsSync(path)) || (process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(executable, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  process.stderr.write('Cannot start Python. Activate a virtual environment or set PSCUBESAT_PYTHON.\n');
}
process.exit(result.status ?? 1);
