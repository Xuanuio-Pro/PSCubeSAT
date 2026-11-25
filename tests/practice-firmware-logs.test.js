// Every Serial line each curriculum sketch (and the PTITCube library it calls) can print, with what the
// practice visualization must read from it. Lines are written from the sketch format strings in
// fastapi-backend/app/firmware/curriculum/*.cpp and compiler/overrides (library 74065b6), error paths included.
// Expectation: f = frame fields, e = events "group:phase", inv = invalidated fields, 0 = plain text (no data, no event).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRICULUM } from '../src/data/curriculum.js';
import { createPracticeDecoder, practiceProfile } from '../src/telemetry/practice.js';
import { visualizationPlan } from '../src/telemetry/visualization-plan.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 500 }, (_, i) => i % 251), 0xff, 0xd9]);
const IMAGE = ['IMG_BEGIN:' + JPEG.length, 'IMG_CHUNK:' + JPEG.subarray(0, 384).toString('base64'), 'IMG_CHUNK:' + JPEG.subarray(384).toString('base64'), 'IMG_END'];
const ACC = ['accX', 'accY', 'accZ'];
const GYRO = ['gyroX', 'gyroY', 'gyroZ'];
const GPS_NONE = ['gpsLat', 'gpsLon', 'gpsAlt'];
const LIBRARY_CAMERA_ERRORS = ['Camera: SD mount failed', 'Camera: SD not ready', 'Camera: Invalid SIZE (expected 4..524288 bytes): SIZE:0',
  'Camera: ERROR:CAPTURE', 'Camera: Timeout: No response from ESP32-CAM', 'Camera: Mkdir failed: /photos', 'Camera: Open file failed: /photos/image_0.jpg',
  'Camera: Capture invalid: 100/31234 bytes, write_ok=1, jpeg=0', 'Camera: SD rename failed; complete JPEG remains in /photos/image_0.jpg.part'];
const cameraErrors = lines => lines.map(line => [line, { e: 'camera:error' }]);
const LED = [['LED ON', { f: { ledOn: true }, e: 'led:ok' }], ['LED OFF', { f: { ledOn: false }, e: 'led:ok' }]];
const IMU = [
  ['Gyro:  X:   0.00, Y:   0.00, Z:   1.00 rad/s', { f: { gyroZ: 180 / Math.PI } }],
  ['Accel: X:   0.00, Y:   0.00, Z:   9.81 m/s2', { f: { accZ: 9.81 / 9.80665 } }],
  ['Mag:   X:  20.00, Y:  30.00, Z:  40.00 uT', { f: { magX: 20, magZ: 40 } }],
  ['Roll:   0.0, Pitch:  -0.0, Head:  56.3', { e: 'attitude:sample' }],
];
const IMU_NAN = [
  ['Gyro:  X:    nan, Y:    nan, Z:    nan rad/s', { inv: GYRO }],
  ['Accel: X:    nan, Y:    nan, Z:    nan m/s2', { inv: ACC }],
  ['Mag:   X:    nan, Y:    nan, Z:    nan uT', { inv: ['magX', 'magY', 'magZ'] }],
];
const EPS = [
  ['V: 3.912 V | SOC: 85.0 % | Rate: +0.12 %/h', { f: { voltageV: 3.912 } }],
  // MAX17048 missing: the raw register read returns 0. A fuel gauge powered by the cell never reads 0 V (Lab7 uses the same 0.5 V rule).
  ['V: 0.000 V | SOC: 0.0 % | Rate: +0.00 %/h', { inv: ['voltageV'] }],
];
const SD_LIBRARY = [['Storage: SD mount failed', { e: 'storage:error' }]];
const TELEM7 = '[TELEM] {"eps":{"v":3.72,"pct":61.5,"rate":-0.4},"env":{"temp":28.5,"press":1012.25},"imu":{"roll":0,"pitch":0,"yaw":56.3,"ax_ms2":0,"ay_ms2":0,"az_ms2":9.80665,"gx_rads":0,"gy_rads":0,"gz_rads":1},"gps":{"lat":21.0285,"lng":105.8542,"alt":12,"sats":8}}';
const LAB7_COMMANDS = [
  ['Received command: a', { e: 'radio:received' }],
  ['Acceleration: ax=0.12, ay=-0.05, az=9.81 m/s^2', { f: { accZ: 9.81 / 9.80665 } }],
  ['Gyroscope: gx=0.00, gy=0.00, gz=1.00 rad/s', { f: { gyroZ: 180 / Math.PI } }],
  ['GPS: no valid fix', { inv: GPS_NONE }],
  ['ERR: Sensors disabled in power saving mode', { e: 'system:error' }],
  ['Power saving mode ENABLED (Low battery). Sensors and camera disabled.', { e: 'power:reported' }],
  ['Power saving mode DISABLED (Battery recovered). All subsystems active.', { e: 'power:reported' }],
  ['Telemetry PAUSED', 0], ['Telemetry RESUMED', 0], ['Unknown command', 0],
  ['Saving battery data to SD card...', { e: 'storage:reported' }], ['Done saving. Reading from SD card:', { e: 'storage:reported' }], ['[1/5] Bat: 3.70V, 85.0%', { e: 'storage:reported' }], ['Done reading from SD card.', { e: 'storage:reported' }],
  ['Capturing photo with ESP32-CAM...', { e: 'camera:start' }],
];

const LOGS = {
  'Lab1-01_Blink_LED': LED,
  'Lab1-02_Control_Multiple_LEDs': [],
  'Lab1-03_PWM_LED': [],
  'Lab1-03_Button': [['BUTTON: Pressed', { e: 'button:ok' }], ['BUTTON: Released', { e: 'button:ok' }]],
  'Lab1-04_LED_Button': [['LED: ON', { f: { ledOn: true } }], ['LED: OFF', { f: { ledOn: false } }]],
  'Lab1-05_7_Segment_LED': [],
  'Lab1-06_Serial_Communication': [['Hello PTITCube / CubeSat!', { e: 'serial:sample' }], ['Echo: abc', { e: 'serial:received' }], ['ERR: Serial input exceeds 128 bytes', { e: 'system:error' }]],
  'Lab1-07_Serial_Control_LED': [["Gõ '1' để bật LED, '0' để tắt LED", 0], ...LED],
  'Lab1-08_WiFi_Connection': [['Connecting to MyWiFi', 0], ['.....', 0], ['WiFi connected.', { e: 'network:reported' }], ['IP address: ', { e: 'network:reported' }], ['192.168.1.10', { e: 'network:reported' }],
    ['[ERROR] WiFi connection timed out. Set ssid/password and retry; no network connection confirmed.', { e: 'network:error' }], ['[WARNING] WiFi disconnected; retrying.', { e: 'network:error' }]],
  'Lab1-09_WiFi_AP_Mode': [['Configuring access point...AP IP address: ', { e: 'network:reported' }], ['192.168.4.1', { e: 'network:reported' }],
    ['Số lượng thiết bị đang kết nối: 1', { e: 'network:reported' }], ['[ERROR] WiFi AP initialization failed', { e: 'network:error' }]],
  'Lab1-10_Web_Server_LED': [['WiFi connected.', { e: 'network:reported' }], ['HTTP server started', { e: 'network:reported' }], ['192.168.1.20', { e: 'network:reported' }], ...LED],
  'Lab2-01a_Battery_I2C': EPS,
  'Lab2-01b_Battery_Library': EPS,
  'Lab2-02_Power_Saving': [['EPS: Normal Mode (V: 3.91V, SOC: 85.0%)', { f: { voltageV: 3.91 }, e: 'power:reported' }],
    ['EPS: Power Saving Mode (V: 3.65V, SOC: 20.0%)', { f: { voltageV: 3.65 }, e: 'power:reported' }],
    ['EPS: Power Saving Mode (V: 0.00V, SOC: 0.0%)', { inv: ['voltageV'], e: 'power:reported' }]],
  'Lab3-01a_MicroSD_SPI': [['Hello World #0', 0], ['SD: Saved to /log.txt', { e: 'storage:saved' }], ['SD: Write failed; entry not saved', { e: 'storage:error' }],
    ['SD: Mount failed', { e: 'storage:error' }], ['SD: Open /log.txt failed', { e: 'storage:error' }], ['SD: Short write: 10/16 bytes', { e: 'storage:error' }]],
  'Lab3-01b_MicroSD_Library': [['Hello World #2', 0], ['[SD] log saved', { e: 'storage:saved' }], ['[SD] log write failed/not ready', { e: 'storage:error' }], ...SD_LIBRARY],
  'Lab3-02_Linux_FS_Commands': [['> ls', { e: 'storage:reported' }], ['Storage: List: /', 0], ['DIR:  demo', { e: 'storage:reported' }], ['FILE: log.txt  (12 bytes)', { e: 'storage:reported' }],
    ['OK', { e: 'shell:ok' }], ['> cd nowhere', { e: 'storage:reported' }], ['ERR: Directory not found: /nowhere', { e: 'shell:error' }],
    ['Storage: SD not ready', { e: 'storage:error' }], ['ERR: Command exceeds 128 bytes', { e: 'storage:error' }], ...SD_LIBRARY],
  'Lab3-03_Multitasking_Scheduler': [['TELEM: #0001 | V: 3.70V | T: 24.5C | Uptime: 2s', { e: 'task:sample' }], ['DIAG: Free Heap: 250000 bytes | CPU: 240 MHz', { e: 'task:sample' }]],
  'Lab3-04_Watchdog_And_Event': [['BOOT: Nguyen nhan khoi dong: Normal Power-on/Reset', 0],
    ["BOOT: GPIO 4 dang o muc LOW (chan Buck tren bo ve tinh): nut nhan khong dung duoc, go 'f' de mo phong treo.", 0], ['WDT: Treo he thong! Ngung feed WDT -> Tu dong khoi dong lai sau 3s...', { e: 'alert:error' }],
    ['E (4012) task_wdt: Task watchdog got triggered. The following tasks did not reset the watchdog in time:', { e: 'alert:error' }],
    ['BOOT: Nguyen nhan khoi dong: Task Watchdog Reset (TWDT da tu phuc hoi)', { e: 'alert:recovered' }]],
  'Lab3-05_Event_Driven_Queue': [['Event: Button (t=1200ms) -> LED: ON', { e: 'task:sample' }], ['Event: Temp Alert: 33 C (t=2000ms)', { e: 'task:sample' }], ["Event: Cmd: 'A' (t=2500ms)", { e: 'task:sample' }]],
  'Lab4-01a_Environment_I2C': [['Temp: 28.50 C | Press: 1012.3 hPa', { f: { temperatureC: 28.5, pressureHpa: 1012.3 } }], ['Warning: Sensor not detected!', { e: 'sensor:error' }],
    ['BMP280 unavailable: check wiring (SDA 21, SCL 22)', { e: 'sensor:error', inv: ['temperatureC', 'pressureHpa'] }]],
  'Lab4-01b_Environment_Library': [['Temp: 28.50 C | Press: 1012.3 hPa', { f: { temperatureC: 28.5, pressureHpa: 1012.3 } }], ['Temp: nan C | Press: nan hPa', { inv: ['temperatureC', 'pressureHpa'] }]],
  'Lab4-02a_IMU_I2C': [...IMU, ['MPU6500 read failed: check wiring (SDA 21, SCL 22)', { e: 'sensor:error', inv: [...ACC, ...GYRO] }]],
  'Lab4-02b_IMU_Library': [...IMU, ...IMU_NAN],
  'Lab4-03a_GPS_UART': [['$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47', { f: { gpsLat: 48.1173, gpsAlt: 545.4 }, e: 'gps:sample' }],
    ['$GPRMC,123519,V,,,,,,,230394,,,N*51', { inv: GPS_NONE, e: 'gps:waiting' }], ['$GPGSV,1,1,00*79', 0]],
  'Lab4-03b_GPS_Library': [['NMEA RAW: OK   (GGA) $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47', { f: { gpsLat: 48.1173 }, e: 'gps:sample' }],
    ['NMEA RAW: FAIL (GGA) $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*00', 0], ['NMEA RAW: OK   (GSV) $GPGSV,1,1,00*79', 0]],
  'Lab4-03c_GPS_PTITCube': [['GPS: 8 sats | Lat: 21.028500, Lng: 105.854200 | Alt: 12.3m | Spd: 0.0km/h | HDOP: 0.9', { f: { gpsLat: 21.0285, gpsLon: 105.8542, gpsAlt: 12.3 } }],
    ['GPS: Đang quét tìm vệ tinh... (3 sats, chưa có fix)', { inv: GPS_NONE, e: 'gps:waiting' }]],
  'Lab4-04a_Camera_UART': [["Camera: San sang. Go 'capture' de chup anh.", 0], ['Camera: Da nhan 1024 / 31234 bytes', { e: 'camera:progress' }],
    ['Camera: Saved /photos/uart_img_0.jpg (31234 bytes)', { e: 'camera:saved' }], [IMAGE[0], { e: 'camera:progress' }], ...IMAGE.slice(1, -1).map(line => [line, 0]), [IMAGE.at(-1), { f: { imageData: true }, e: 'camera:saved' }],
    ["Camera: Lenh 'x' khong hop le. Go 'capture' de chup anh.", 0],
    ...cameraErrors(['Camera: Timeout hoac khong nhan duoc SIZE.', 'Camera: ESP32-CAM bao loi: ERROR:CAPTURE', 'Camera: SIZE khong hop le (0 bytes).',
      'Camera: Khong the tao file /photos/uart_img_1.jpg.', 'Camera: Ghi the nho that bai; file /photos/uart_img_1.jpg khong day du.', 'Camera: Loi truyen nhan (100/31234 bytes)',
      'Camera: Du lieu 31234 bytes khong phai JPEG hop le (SOI/EOI).', 'Camera: The nho chua san sang.', 'ERROR:IMG_OPEN', 'ERROR:IMG_SIZE:0', 'ERROR:IMG_READ'])],
  'Lab4-04b_Camera_Library': [["Camera: San sang. Go 'p' hoac 'capture' de chup anh.", 0], ['Camera: Dang chup /photos/image_1.jpg', { e: 'camera:start' }],
    ['Camera: Saved /photos/image_1.jpg (31234 bytes)', { e: 'camera:saved' }], [IMAGE[0], { e: 'camera:progress' }], ...IMAGE.slice(1, -1).map(line => [line, 0]), [IMAGE.at(-1), { f: { imageData: true }, e: 'camera:saved' }],
    ...cameraErrors(['Camera: Chup that bai.', "Camera: The nho chua san sang; go 'capture' de thu lai.", ...LIBRARY_CAMERA_ERRORS])],
  'Lab4-05_Read_All_Sensors': [['TELEM: T: 28.5C | P: 1012.2hPa | Roll: 0.0 | Pitch: -0.0 | GPS: (21.0285, 105.8542, 8sats)', { f: { temperatureC: 28.5, pressureHpa: 1012.2, gpsLat: 21.0285, gpsLon: 105.8542 } }],
    ['Accel: X:   0.00, Y:   0.00, Z:   9.81 m/s2', { f: { accZ: 9.81 / 9.80665 } }],
    ['TELEM: T: nanC | P: nanhPa | Roll: nan | Pitch: nan | GPS: (no fix, 0sats)', { inv: ['temperatureC', 'pressureHpa', ...GPS_NONE] }],
    ['Accel: X:    nan, Y:    nan, Z:    nan m/s2', { inv: ACC }]],
  'Lab4-06_Camera_Multiplexer': [['Camera: Saved /photos/mux_0.jpg (31234 bytes)', { e: 'camera:saved' }], ['GPS: Lat: 21.028500, Lng: 105.854200', { f: { gpsLat: 21.0285, gpsLon: 105.8542 } }],
    ['GPS: Đang quét tìm vệ tinh... (0 sats, chưa có fix)', { e: 'gps:waiting', inv: GPS_NONE }],
    [IMAGE[0], { e: 'camera:progress' }], ...IMAGE.slice(1, -1).map(line => [line, 0]), [IMAGE.at(-1), { f: { imageData: true }, e: 'camera:saved' }],
    ...cameraErrors(['Camera: Chup that bai.', 'ERROR:IMG_OPEN', 'ERROR:IMG_SIZE:0', 'ERROR:IMG_READ', ...LIBRARY_CAMERA_ERRORS])],
  'Lab5-01a_Send_Telemetry_UART': [['TX: PACKET #1 - CUBESAT TELEMETRY', { e: 'radio:sent' }], ['LoRa AUX busy; TX skipped: PACKET #2 - CUBESAT TELEMETRY', { e: 'radio:error' }]],
  'Lab5-01b_Send_Telemetry_Library': [['TX: PACKET #1 - CUBESAT TELEMETRY', { e: 'radio:sent' }]],
  'Lab5-02a_Receive_Command_UART': [['[BOOT] OBC san sang, dang cho lenh tu tram mat dat qua LoRa (UART1)', { e: 'system:boot' }], ['RX: ping', { e: 'radio:received' }]],
  'Lab5-02b_Receive_Command_Library': [['[BOOT] OBC san sang, dang cho lenh tu tram mat dat qua LoRa', { e: 'system:boot' }], ['RX: led on', { e: 'radio:received' }]],
  'Lab5-03_Satellite_Comm_System': [['[BOOT] OBC san sang, dang cho lenh tu tram mat dat qua LoRa (ping, battery, sensor, imu, gps, led on/off, telemetry)', { e: 'system:boot' }],
    ['CMD: ping -> pong - CubeSat OK', { e: 'radio:received' }], ['CMD: sensor -> Temp: 28.5C | Press: 1012.2hPa', { e: 'radio:received' }],
    ['CMD: telemetry -> {"v":3.7,"t":28.5,"p":1012.2,"valid":false,"lat":null,"lng":null}', { e: 'radio:received' }], ['CMD: foo -> ERR: Unknown cmd [foo]', { e: 'radio:received' }]],
  'Lab7-01_Full_Satellite_Program': [['[BOOT] PTITCube Satellite System Ready', { e: 'system:boot' }], [TELEM7, { f: { voltageV: 3.72, temperatureC: 28.5, pressureHpa: 1012.25, accZ: 1, gpsLat: 21.0285 } }],
    ['[TELEM] {"eps":{"v":3.72,"pct":61.5,"rate":-0.4},"env":{"temp":28.5,"press":1012.25},"gps":{"valid":false}}', { f: { voltageV: 3.72 }, e: 'gps:waiting', inv: GPS_NONE }],
    ['[LORA TX] 3 goi telemetry', { e: 'radio:sent' }],
    ['[SD] Telemetry saved', { e: 'storage:saved' }], ['[SD] Write failed / card not ready', { e: 'storage:error' }],
    ['[TELEM] {"eps":{"v":3.42,"pct":15.0,"pwr_save":true}}', { f: { voltageV: 3.42 } }], ['ALERT: Power saving mode ENABLED', { e: 'power:reported' }], ['ALERT: Power saving mode DISABLED', { e: 'power:reported' }],
    ...LAB7_COMMANDS, ['GPS: Lat=21.028500, Lng=105.854200, Alt=12.3m', { f: { gpsLat: 21.0285, gpsAlt: 12.3 } }], ['GPS: Waiting for fix...', { inv: GPS_NONE }],
    ['Photo captured and saved to SD: /photos/cam_0.jpg', { e: 'camera:saved' }], ['Camera capture failed!', { e: 'camera:error' }], ...SD_LIBRARY],
  'Lab7-02_RTOS_Satellite_System': [['[TELEMETRY] EPS: {"battery_v":3.72}', { f: { voltageV: 3.72 } }], ['[TELEMETRY] Env: {"temp":28.50,"pressure":1012.25}', { f: { temperatureC: 28.5 } }],
    ['[TELEMETRY] Acc: {"acc_x":0.00,"acc_y":0.00,"acc_z":9.81}', { f: { accZ: 9.81 / 9.80665 } }], ['[TELEMETRY] Gyro: {"gyro_x":0.00,"gyro_y":0.00,"gyro_z":1.00}', { f: { gyroZ: 180 / Math.PI } }],
    ['[TELEMETRY] Mag: {"mag_x":20.00,"mag_y":30.00,"mag_z":40.00}', { f: { magX: 20 } }], ['[TELEMETRY] GPS: {"valid":true,"lat":21.0285,"lng":105.8542}', { f: { gpsLat: 21.0285 } }],
    ['[TELEMETRY] GPS: {"valid":false,"lat":null,"lng":null}', { inv: GPS_NONE }], ['[TELEMETRY] Env: {"temp":null,"pressure":null}', { inv: ['temperatureC', 'pressureHpa'] }],
    ['[SD] telemetry saved', { e: 'storage:saved' }], ['[SD] telemetry write failed', { e: 'storage:error' }], ['[LORA TX] 6 goi telemetry', { e: 'radio:sent' }], ['[TELEMETRY] EPS: {"battery_v":3.42,"pwr_save":true}', { f: { voltageV: 3.42 } }],
    ...LAB7_COMMANDS, ['GPS: Lat=21.028500, Lng=105.854200', { f: { gpsLat: 21.0285 } }], ['Photo captured! Path: /photos/rtos_0.jpg', { e: 'camera:saved' }],
    ['Camera capture failed!', { e: 'camera:error' }], ['ERR: Camera disabled in power saving mode!', { e: 'camera:error' }]],
  'Lab8-01_Custom_Mission': [['[BOOT] Khung Lab8 san sang: EPS, Sensor, GPS, Storage, COM da khoi tao. Them nhiem vu vao loop().', { e: 'system:boot' }]],
};

// What each data panel needs to show something. Link/command panels are static and need no data.
const FEEDS = {
  voltage: r => r.fields.voltageV !== undefined, environment: r => r.fields.temperatureC !== undefined || r.fields.pressureHpa !== undefined,
  attitude: r => ACC.some(key => r.fields[key] !== undefined), gps: r => r.fields.gpsLat !== undefined, camera: r => r.events.includes('camera:saved'),
  storage: r => r.events.some(event => event.startsWith('storage:')), radio: r => r.events.some(event => event.startsWith('radio:')),
  shell: r => r.events.some(event => event.startsWith('shell:')), lab1Connection: r => r.events.includes('network:reported'),
  lab1Io: r => r.events.some(event => event.startsWith('led:') || event.startsWith('button:')),
  network: r => r.events.includes('network:reported'), system: r => Object.keys(r.fields).length > 0,
  groundStation: () => true, commands: () => true, dashboard: () => true,
};

const practices = Object.values(CURRICULUM).flatMap(lab => lab.lessons.filter(lesson => lesson.type === 'practice'));
const source = id => readFileSync(new URL(`../fastapi-backend/app/firmware/curriculum/${id}.cpp`, import.meta.url), 'utf8');

test('every curriculum practice has a log inventory', () => {
  assert.deepEqual(Object.keys(LOGS).sort(), practices.map(lesson => lesson.id).sort());
});

for (const { id } of practices) test(`firmware log → visualization: ${id}`, () => {
  const decode = createPracticeDecoder(id);
  const seen = { fields: {}, events: [] };
  for (const [index, [line, expected]] of LOGS[id].entries()) {
    const result = decode({ type: 'rx', origin: 'serial', text: line, receivedAt: 10000 + index * 100 });
    const fields = Object.fromEntries(Object.entries(result.frame ?? {}).filter(([key, value]) => value !== null && !['receivedAt', 'deviceId', 'source', 'timestamp', 'seq', 'uptimeMs'].includes(key) && !key.startsWith('_')));
    const events = result.events.map(event => `${event.group}:${event.phase}`);
    Object.assign(seen.fields, fields); seen.events.push(...events);
    if (expected === 0) {
      assert.deepEqual([fields, events, result.invalidate], [{}, [], []], `${line} must stay plain text`);
      continue;
    }
    for (const [key, value] of Object.entries(expected.f ?? {})) {
      if (value === true) assert.ok(fields[key], `${line} → ${key}`);
      else assert.ok(Math.abs(fields[key] - value) < 1e-6, `${line} → ${key}: ${fields[key]} != ${value}`);
    }
    for (const event of [expected.e ?? []].flat()) assert.ok(events.includes(event), `${line} → missing ${event} (got ${events.join(', ') || 'none'})`);
    for (const key of expected.inv ?? []) assert.ok(result.invalidate.includes(key), `${line} → must invalidate ${key} (got ${result.invalidate.join(', ') || 'none'})`);
    if (expected.inv && !expected.f) assert.deepEqual(Object.keys(fields).filter(key => expected.inv.includes(key)), [], `${line} must not report an unavailable value`);
  }
  // Every panel the exercise shows must be fed by something its firmware actually prints.
  for (const panel of visualizationPlan(practiceProfile(id)).panels) {
    assert.ok(FEEDS[panel]?.(seen), `${id}: panel "${panel}" gets no data from the sketch output`);
  }
});

test('the inventory covers every literal message the sketches print', () => {
  const lines = Object.values(LOGS).flat().map(([line]) => line).join('\n');
  const missing = [];
  for (const { id } of practices) {
    const code = source(id);
    // Leading literal of each print / notify call, e.g. cdh.printf("Temp: %.2f C ...") → "Temp: ".
    for (const match of code.matchAll(/(?<!Serial[12].)(?:print(?:ln|f)?|notify)\(\s*(?:[^"()]*\?\s*)?"([^"%\\]{4,})/g)) {
      const literal = match[1].trim();
      if (!literal || /^[-=*#> ]+$/.test(literal)) continue;
      if (!lines.includes(literal)) missing.push(`${id}: "${literal}"`);
    }
  }
  assert.deepEqual(missing, [], 'printed text without a visualization expectation');
});
