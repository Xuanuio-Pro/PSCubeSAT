"""Trusted PlatformIO post script; export the same image addresses as upload.

Runs after the platform/framework scripts, before compilation. The API only
packages these paths after the entire build has succeeded.
"""
import json
from pathlib import Path

Import("env")  # noqa: F821 -- provided by SCons

board = env.BoardConfig()
images = [
    {"offset": int(str(offset), 0), "path": env.subst(str(path))}
    for offset, path in env.get("FLASH_EXTRA_IMAGES", [])
]
images.append({
    "offset": int(env.subst("$ESP32_APP_OFFSET"), 0),
    "path": env.subst("$BUILD_DIR/${PROGNAME}.bin"),
})
manifest = {
    "chip": board.get("build.mcu"),
    "mode": env.subst("${__get_board_flash_mode(__env__)}"),
    "frequency": env.subst("${__get_board_f_image(__env__)}"),
    "size": board.get("upload.flash_size", "4MB"),
    "files": sorted(images, key=lambda image: image["offset"]),
}
output = Path(env.subst("$BUILD_DIR")) / "flash-manifest.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(manifest), encoding="utf-8")
