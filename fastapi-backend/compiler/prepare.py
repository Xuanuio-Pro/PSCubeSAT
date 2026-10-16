from pathlib import Path
import shutil
import subprocess
import json
from platformio.package.manager.library import LibraryPackageManager
from build_config import _PIO_INI
ROOT = Path("/opt/compiler")

def prepare():
    for board, ini in _PIO_INI.items():
        project = Path('/opt/projects') / board
        (project / 'src').mkdir(parents=True)
        (project / 'platformio.ini').write_text(ini)
        shutil.copyfile(ROOT / 'ptitcube_smoke.cpp', project / 'src/main.cpp')
        shutil.copyfile(ROOT / 'export_flash_manifest.py', project / 'export_flash_manifest.py')
        # Upstream 1.0.0 uses a Git URL as a registry name. Arduino-ESP32 already
        # ships esp_camera.h + the matching driver, so do not fetch a second IDF driver.
        library_dir = project / '.pio/libdeps' / board
        library_dir.mkdir(parents=True)
        spec = next(line.strip() for line in ini.splitlines() if 'PTITCube-Library.git#' in line)
        package = LibraryPackageManager(str(library_dir)).install(spec, skip_dependencies=True)
        manifest_path = Path(package.path) / 'library.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['dependencies'].pop('https://github.com/espressif/esp32-camera.git', None)
        manifest_path.write_text(json.dumps(manifest, indent=2))
        # Versioned local fixes to the pinned upstream library; no user source rewrite.
        shutil.copytree(ROOT / 'overrides', Path(package.path) / 'src', dirs_exist_ok=True)
        subprocess.run(['pio', 'run', '-j', '2', '-d', str(project), '-e', board], check=True)
        shutil.copyfile(ROOT / 'camera_driver_smoke.cpp', project / 'src/main.cpp')
        subprocess.run(['pio', 'run', '-j', '2', '-d', str(project), '-e', board], check=True)
        # Only trusted dependencies are cached. Each runtime compiles its own source.
        shutil.rmtree(project / '.pio/build')


prepare()
