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
\thttps://github.com/PTITCube/PTITCube-Library.git#74065b64f670b14b7987c901c854ffe0e6fe69c5
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
\thttps://github.com/PTITCube/PTITCube-Library.git#74065b64f670b14b7987c901c854ffe0e6fe69c5
""",
}

# Bump when compiler-side library fixes change, rejecting stale compiler images.
_PIO_INI = {
    board: ini
    + "\n; PTITCube library 74065b6 (CDH/MUX layout) + overrides: shared UART2 baud, camera p command + JPEG validation, GPS fix age, recursive bus mutexes, UART2/MQTT buses, NaN sensor readings, SD write counts, hidden MQTT photo uplink v9\n"
    for board, ini in _PIO_INI.items()
}
