_PIO_INI: dict[str, str] = {
    "esp32s3": """\
[platformio]
default_envs = esp32s3

[env:esp32s3]
platform = espressif32@6.10.0
board = esp32-s3-devkitc-1
framework = arduino
monitor_speed = 115200
extra_scripts = post:export_flash_manifest.py
build_flags =
\t-DARDUINO_USB_CDC_ON_BOOT=1
\t-DARDUINO_USB_MODE=1
lib_deps =
\thttps://github.com/PTITCube/PTITCube-Library.git#218d2b6b78b75140962999cc7aad0c786838bb25
""",
    "esp32": """\
[platformio]
default_envs = esp32

[env:esp32]
platform = espressif32@6.10.0
board = esp32doit-devkit-v1
framework = arduino
monitor_speed = 115200
extra_scripts = post:export_flash_manifest.py
lib_deps =
\thttps://github.com/PTITCube/PTITCube-Library.git#218d2b6b78b75140962999cc7aad0c786838bb25
""",
}

# Bump when compiler-side library fixes change, rejecting stale compiler images.
_PIO_INI = {board: ini + '\n; PTITCube sensor readiness + MPU6500 + GPS aliases + UART2 mutex + camera validation/shared UART patch v6\n' for board, ini in _PIO_INI.items()}
