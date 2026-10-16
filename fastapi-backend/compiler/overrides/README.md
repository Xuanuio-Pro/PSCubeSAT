# Local PTITCube compatibility fixes

Base: PTITCube/PTITCube-Library commit `218d2b6b78b75140962999cc7aad0c786838bb25`.
`prepare.py` overlays these directories onto the installed library's `src/` before compiling trusted dependencies. They are not edits to submitted sketches or changes published upstream.

- Sensor: gate configuration and reads on successful initialization; disabled/unavailable readings are NaN. Add MPU6500 WHO_AM_I 0x70 support with checked register reads/writes, 8g and 500 degrees/s ranges. Public units remain Celsius, hPa, m/s², rad/s and Gauss. MPU6050 keeps its Adafruit driver. MPU9250 is not supported by this patch.
- GPS: aliases for curriculum API names and a location freshness check (5 seconds).
- Scheduler: dedicated UART2 mutex index 4; increase mutex array count to 5. This does not make arbitrary task code thread-safe.

- Camera v5: validate SIZE, cap transfer duration/length, check SD write counts and JPEG SOI/EOI, write temporary files and report failures honestly. `isReady()` still means SD readiness, not proof of a working image sensor.
- GPS v5: share the existing Serial2 instance with Camera instead of constructing a second HardwareSerial for the same peripheral. Callers must still serialize UART2 access and handle MUX/baud transitions.

- v6 Sensor: maximum 50 Hz sampling, BMP280 10 Hz, cached QMC 2G scale, checked MPU register read with STOP, per-device failure counters. No global suppression of I2C error logging.
- v6 Camera: change baud only when needed, preserving the UART instance; feed a registered task watchdog during bounded long image transfers.
- v6 Storage: report successful writes only when all requested bytes were written.
- v6 CDH: bound WiFi connection/config portal setup; proceed offline after timeout.
- v6 Scheduler: add a separate MQTT mutex. The corrected RTOS example uses atomic pause state, sensor/ADC snapshots, UART/SPI locks for capture, MQTT serialization, valid JSON for missing data and batched SD writes. Other user sketches must use their own appropriate synchronization.

The build configuration revision must change whenever these patches change so an outdated compiler image cannot return an accepted artifact. Current revision: v6. Rebuild from `fastapi-backend` with `docker build -f compiler/Dockerfile -t pscubesat-compiler:1 .`.

Hardware verification and limits: `Docs/CURRICULUM_SERIAL_AUDIT_2026-10-15.md` at repository root. Sensor wiring currently uses ESP32 GPIO21/22; do not infer S3 pin compatibility from compilation alone. Corrected curriculum sketches are in `app/firmware/curriculum/` and must be selected explicitly; the compiler never silently rewrites user source.
