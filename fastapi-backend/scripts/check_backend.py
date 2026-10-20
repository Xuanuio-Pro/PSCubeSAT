"""Run backend style and regression checks using the current Python interpreter.

Usage: python scripts/check_backend.py [--fix] [--postgres]
PostgreSQL integration tests create/drop isolated test databases only.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fix", action="store_true", help="Apply safe lint fixes and formatting.")
    parser.add_argument("--postgres", action="store_true", help="Enable isolated PostgreSQL tests.")
    args = parser.parse_args()
    env = os.environ.copy()
    if args.postgres:
        env["PSCUBESAT_TEST_POSTGRES"] = "1"
    commands = [
        ["ruff", "check", ".", *(["--fix"] if args.fix else [])],
        ["ruff", "format", ".", *([] if args.fix else ["--check"])],
        ["unittest", "discover", "-s", "app/tests", "-p", "test_*.py"],
    ]
    for command in commands:
        result = subprocess.run([sys.executable, "-m", *command], cwd=ROOT, env=env)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
