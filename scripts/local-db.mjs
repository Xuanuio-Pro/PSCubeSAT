// Start/stop the optional Windows-only portable PostgreSQL; other platforms use Docker or DATABASE_URL.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.log('Portable PostgreSQL is Windows-only. Use `npm run dev:db:docker` or your own DATABASE_URL.');
  process.exit(0);
}
const script = join(dirname(fileURLToPath(import.meta.url)), 'local-db.ps1');
const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...process.argv.slice(2)];
const result = spawnSync('powershell', args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
