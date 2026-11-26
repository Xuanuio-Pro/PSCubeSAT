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
\thttps://github.com/PTITCube/PTITCube-Library.git#b684dc01a76d4a0f5e646339cefa9cad2672c85b
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
\thttps://github.com/PTITCube/PTITCube-Library.git#b684dc01a76d4a0f5e646339cefa9cad2672c85b
""",
}

# Bump when compiler-side library fixes change, rejecting stale compiler images.
_PIO_INI = {
    board: ini
    + "\n; PTITCube library b684dc0 (CDH/MUX layout, EPS getters 0 when unread) + overrides: shared UART2 baud, camera p command + JPEG validation, GPS fix age, recursive bus mutexes, UART2/MQTT buses, NaN sensor readings, SD write counts, hidden MQTT photo uplink v10 (broker in CFG?)\n"
    for board, ini in _PIO_INI.items()
}
