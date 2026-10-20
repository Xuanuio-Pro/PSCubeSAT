"""Expose trusted tool files to the unprivileged worker without copying up unchanged files."""

import stat
from pathlib import Path

for root in (Path("/opt/platformio"), Path("/opt/projects")):
    for path in [root, *root.rglob("*")]:
        if path.is_symlink():
            continue
        mode = stat.S_IMODE(path.stat().st_mode)
        wanted = mode | 0o444
        if path.is_dir() or mode & 0o111:
            wanted |= 0o111
        if wanted != mode:
            path.chmod(wanted)
