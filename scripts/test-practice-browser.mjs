// Run against a dev server; USB is mocked in an isolated browser. No board is opened or flashed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PSCUBESAT_PLAYWRIGHT || 'playwright');
const fixtures = JSON.parse(await readFile(new URL('../tests/fixtures/practice-serial.json', import.meta.url), 'utf8'));
const base = process.env.PSCUBESAT_WEB_URL || 'http://localhost:5175';
const output = path.resolve('build_cache/practice-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PSCUBESAT_BROWSER_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const errors = [];
let activeToken = '';
let revoke = false;
let expiresIn = 3600;
let sourceAuthorized = false;
const mockUser = { id: 7, email: 'practice@example.test', full_name: 'Practice Test', role: 'user' };
await page.route('**/api/**', async intercepted => {
  const req = intercepted.request();
  const pathname = new URL(req.url()).pathname;
  const reply = (json, status = 200) => intercepted.fulfill({ status, json });
  if (pathname === '/api/auth/google/config') return reply({ enabled: false });
  if (pathname === '/api/auth/login') {
    activeToken = `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresIn })).toString('base64url')}.test`;
    revoke = false;
    return reply({ access_token: activeToken, user: mockUser });
  }
  if (req.headers().authorization !== `Bearer ${activeToken}` || !activeToken || revoke) return reply({ detail: 'Session expired' }, 401);
  if (pathname === '/api/auth/me') return reply(mockUser);
  if (pathname === '/api/auth/logout') { revoke = true; return reply({ message: 'Logged out' }); }
  if (pathname === '/api/devices') return reply([]);
  if (pathname.startsWith('/api/progress')) return reply({});
  if (pathname.endsWith('/source')) {
    sourceAuthorized = true;
    const source = await readFile(new URL('../fastapi-backend/app/firmware/curriculum/Lab6-02_Watchdog_And_Event.cpp', import.meta.url), 'utf8');
    return intercepted.fulfill({ status: 200, contentType: 'text/plain', body: source });
  }
  return reply({});
});
page.on('pageerror', error => errors.push(`${page.url()}: ${error.stack || error.message}`));
await page.addInitScript(() => {
  let controller;
  const writes = [];
  let closed = 0;
  const port = {
    open: async () => {
      port.readable = new ReadableStream({ start(value) { controller = value; } });
      port.writable = new WritableStream({ write(bytes) { writes.push(new TextDecoder().decode(bytes)); } });
    },
    close: async () => { closed++; },
    getInfo: () => ({ usbVendorId: 0x10c4, usbProductId: 0xea60 }),
    readable: null, writable: null,
  };
  Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: async () => port, getPorts: async () => [port] } });
  window.__practiceTest = {
    emit: line => controller.enqueue(new TextEncoder().encode(`${line}\n`)),
    writes,
    closed: () => closed,
  };
});
const route = id => `${base}/lab${/^Lab(\d)/.exec(id)[1]}?lesson=${id}`;
const emit = line => page.evaluate(text => window.__practiceTest.emit(text), line);
const login = async () => {
  await page.getByLabel('Email', { exact: true }).fill('practice@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
};
try {
  await page.goto(route('Lab6-01_Multitasking_Scheduler'));
  await page.waitForURL('**/login');
  assert.equal(await page.getByRole('button', { name: 'Kết nối USB', exact: true }).count(), 0);
  await login();
  await page.waitForURL('**/lab6?lesson=Lab6-01_Multitasking_Scheduler');
  await page.reload(); // A stored token must be verified by /me before mounting services.
  await page.getByRole('heading', { name: 'Tác vụ chạy đồng thời', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kết nối USB', exact: true }).click();
  await page.getByRole('button', { name: 'Ngắt USB', exact: true }).waitFor();
  assert.equal(await page.locator('.lab-visual-stack > :first-child').getByRole('heading', { name: /Serial Monitor/ }).count(), 1);
  await emit('[Sensor] Đang đọc dữ liệu... Nhiệt độ: 28.5C');
  await emit('[Network] BẮT ĐẦU gửi dữ liệu lên máy chủ...');
  await page.waitForTimeout(500);
  await emit('[Network] ĐÃ GỬI XONG!');
  await page.getByText('28.5 °C · giá trị mẫu trong code', { exact: true }).waitFor();
  assert.match(await page.locator('.practice-task-grid').innerText(), /1 lần đọc/);
  assert.match(await page.locator('.practice-task-grid').innerText(), /1 lần hoàn tất/);
  assert.match(await page.locator('.practice-task-grid').innerText(), /Thời gian quan sát: \d+ ms/);
  await emit('LED ON');
  await page.getByText(/Lệnh cuối: Bật/).waitFor();
  assert.equal(await page.getByRole('heading', { name: /System Check/ }).count(), 1);
  await page.locator('.practice-activity').screenshot({ path: path.join(output, 'lab6-scheduler.png') });
  console.log('PASS Lab6: observed task counters, duration, timeline and illustrative provenance');

  // Navigate through the SPA, keeping the same fake USB session and provider.
  async function select(id) {
    await page.evaluate(url => { history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); }, route(id));
    await page.locator(`.lab-visual-stack[data-exercise-id="${id}"]`).waitFor();
    assert.equal(await page.locator('.lab-visual-stack > :first-child').getByRole('heading', { name: /Serial Monitor/ }).count(), 1);
  }
  await select('Lab4-01b_Environment_Library');
  for (const line of fixtures.find(item => item.id === 'Lab4-01b_Environment_Library').lines) await emit(line);
  await page.locator('.environment-reading-value').filter({ hasText: '28.5' }).waitFor();
  await page.locator('.environment-reading-value').filter({ hasText: '1012.3' }).waitFor();
  assert.match(await page.locator('.environment-readings').innerText(), /—/);
  await page.locator('.environment-panel').screenshot({ path: path.join(output, 'lab4-environment.png') });
  await page.waitForTimeout(6100);
  assert.equal(await page.locator('.environment-reading-value').filter({ hasText: '28.5' }).count(), 0);
  console.log('PASS Lab4: multiline readings, correct hPa, absent humidity, independent expiry');

  await select('Lab7-03_RTOS_Satellite_System');
  for (const line of fixtures.find(item => item.id === 'Lab7-03_RTOS_Satellite_System').lines) await emit(line);
  await page.getByText('3.72 V', { exact: true }).waitFor();
  await page.locator('.environment-reading-value').filter({ hasText: '28.5' }).waitFor();
  const cells = await page.locator('.telemetry-grid').innerText();
  assert.match(cells, /57\.296/); assert.match(cells, /20\.000/);
  await page.getByRole('button', { name: '🏓 Ping', exact: true }).click();
  await page.getByText('Đã gửi USB · chờ phản hồi Serial', { exact: false }).waitFor();
  assert.ok((await page.evaluate(() => window.__practiceTest.writes)).includes('ping\n'));
  await emit('[TELEMETRY] GPS: {"valid":false,"lat":0,"lng":0}');
  await page.getByText('Chờ tọa độ từ nguồn đã chọn', { exact: true }).waitFor();
  console.log('PASS Lab7: six sparse packets, SI conversion, USB write status and invalid fix removal');

  await select('Lab4-04b_Camera_Library');
  await page.getByRole('button', { name: 'Chụp ảnh · p', exact: true }).click();
  assert.ok((await page.evaluate(() => window.__practiceTest.writes)).includes('p\n'));
  await emit('[OK] Da luu anh: /photos/image_1.jpg');
  await page.getByText(/Đã lưu tại thiết bị; chưa nhận dữ liệu ảnh/).waitFor();
  await emit('IMG:AAAA');
  await page.getByText(/Đã bỏ qua ảnh không giải mã được/).waitFor();
  await emit('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
  await page.getByRole('img', { name: 'Camera capture', exact: true }).waitFor();
  assert.ok(await page.getByRole('img', { name: 'Camera capture', exact: true }).evaluate(img => img.naturalWidth > 0));
  await page.getByRole('button', { name: 'Ngắt USB', exact: true }).click();
  await page.getByRole('button', { name: 'Kết nối USB', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Chụp ảnh · p', exact: true }).isDisabled().then(disabled => assert.ok(disabled));
  console.log('PASS Camera: actual sketch command, saved-file evidence, no fake image, disconnect disables controls');
  await page.getByRole('button', { name: 'Kết nối USB', exact: true }).click();
  await page.getByRole('button', { name: 'Ngắt USB', exact: true }).waitFor();
  await select('Lab4-02a_IMU_I2C');
  await emit('[RAW] RAW_ACCEL: X = 120 | Y = -220 | Z = 16384');
  await page.getByRole('heading', { name: 'Gia tốc thô · số đếm thanh ghi' }).waitFor();
  await page.getByText('Mẫu mới', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: /3D Attitude Viewer.*chờ IMU/ }).count(), 1);
  for (const panel of ['Tư thế 3D', 'Định vị GPS', 'Camera', 'Môi trường']) assert.equal(await page.getByRole('region', { name: panel, exact: true }).count(), 1);
  console.log('PASS Raw IMU: register counts are visualized without inventing scale or fused attitude');
  await select('Lab6-02_Watchdog_And_Event');
  await emit('{"type":"telemetry","temp":28.5,"pressure":1013,"acc_x":0,"acc_y":0,"acc_z":1,"uptime_ms":10000}');
  await page.locator('.environment-reading-value').filter({ hasText: '28.5' }).waitFor();
  await emit('[SỰ CỐ] EMERGENCY: FREEFALL DETECTED!');
  await page.locator('.practice-evidence--error').filter({ hasText: 'FREEFALL DETECTED!' }).waitFor();
  await emit('[EVENT] No current anomaly in valid measurements.');
  await page.getByText(/Firmware báo hết điều kiện cảnh báo/).waitFor();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải mã mẫu ESP32 (.ino)', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'Lab6-02_Watchdog_And_Event.ino');
  assert.ok(sourceAuthorized);
  console.log('PASS reviewed Lab6: actual sensor visualization, explicit event/recovery and correct source download');
  for (const id of ['Lab1-01_Blink_LED', 'Lab1-02_Serial_Communication', 'Lab1-03_Serial_Control_LED']) {
    await select(id);
    assert.equal(await page.locator('.lab-visual-stack .card').count(), 1);
    assert.equal(await page.getByRole('heading', { name: /LED \/ Serial|Phản hồi Serial \/ Echo|Command Uplink/ }).count(), 0);
  }
  await select('Lab1-04_WiFi_Connection');
  assert.equal(await page.locator('.lab1-connection-notice').count(), 0);
  await emit('WiFi connected.'); await emit('192.168.1.22');
  await page.locator('.lab1-connection-notice').filter({ hasText: 'IP address: 192.168.1.22' }).waitFor();
  assert.equal(await page.locator('.lab1-connection-notice a').count(), 0);
  await select('Lab1-05_WiFi_AP_Mode');
  assert.equal(await page.locator('.lab1-connection-notice').count(), 0);
  await emit('AP IP address:'); await emit('192.168.4.1'); await emit('Số lượng thiết bị đang kết nối: 2');
  await page.locator('.lab1-connection-notice').filter({ hasText: 'Thiết bị đang kết nối: 2' }).waitFor();
  assert.match(await page.locator('.lab1-connection-notice').innerText(), /IP address: 192\.168\.4\.1/);
  await select('Lab1-06_Web_Server_LED');
  assert.equal(await page.locator('.lab1-connection-notice').count(), 0);
  await emit('WiFi connected.'); await emit('IP address: 192.168.1.23');
  await page.locator('.lab1-connection-notice').waitFor();
  assert.equal(await page.locator('.lab1-connection-notice a').count(), 0);
  assert.doesNotMatch(await page.locator('.lab1-connection-notice').innerText(), /HTTP server started/);
  await emit('HTTP server started'); await emit('192.168.1.23'); await emit('LED ON');
  await page.getByRole('link', { name: '192.168.1.23', exact: true }).waitFor();
  assert.match(await page.locator('.lab1-connection-notice').innerText(), /WiFi connected\.[\s\S]*IP address: 192\.168\.1\.23[\s\S]*HTTP server started\./);
  await page.locator('.lab-practice-visualization').screenshot({ path: path.join(output, 'lab1-wifi-connected.png') });
  assert.equal(await page.locator('.lab1-connection-notice').count(), 1);
  assert.equal(await page.getByRole('heading', { name: /Thông tin mạng ESP|WiFi \/ Web server|LED \/ Serial|Phản hồi Serial \/ Echo/ }).count(), 0);
  await emit('[WARNING] WiFi disconnected; retrying.');
  await page.locator('.lab1-connection-notice').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.lab1-connection-notice a').count(), 0);
  await page.locator('.lab-practice-visualization').screenshot({ path: path.join(output, 'lab1-wifi-notice.png') });
  console.log('PASS Lab1: Serial-only 1–3, WiFi 4, AP/client count 5, one web address notice 6; disconnect removes link');
  await select('Lab3-02_Linux_FS_Commands');
  await emit('[Storage] Nội dung thư mục: /logs'); await emit('📄 telemetry.csv (120 bytes)');
  await page.getByRole('heading', { name: 'Thẻ SD / Hệ thống tệp', exact: true }).waitFor();
  await page.locator('.practice-report-list').filter({ hasText: 'telemetry.csv' }).waitFor();
  await emit('ERR: Directory not found');
  await page.locator('.practice-report-list').filter({ hasText: 'Lỗi · ERR: Directory not found' }).waitFor();
  await select('Lab5-03_Satellite_Comm_System');
  const commandCard = page.locator('.card').filter({ has: page.getByRole('heading', { name: /Command Uplink/ }) });
  assert.ok(await commandCard.getByRole('textbox').isDisabled());
  await page.getByLabel('Vai trò cổng lệnh', { exact: true }).selectOption('gs');
  await commandCard.getByRole('button', { name: '🏓 Ping', exact: true }).click();
  await commandCard.getByText('Đã gửi USB · chờ phản hồi Serial', { exact: false }).waitFor();
  console.log('PASS preserved blocks, WiFi/LED reports and real SD listing');
  for (const fixture of fixtures) {
    await select(fixture.id);
    assert.equal(await page.locator('.lab-visual-stack > .serial-card').count(), 1, fixture.id);
    assert.equal(await page.locator('.practice-panel-hint, .blockly-guide, .practice-events').count(), 0, fixture.id);
  }
  console.log('PASS all 32 practices: Serial Monitor first, no duplicate monitor or explanatory banners');
  await page.locator('.header-account-menu summary').click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL('**/login');
  await page.waitForFunction(() => window.__practiceTest.closed() >= 2);
  assert.equal(await page.getByRole('button', { name: 'Kết nối USB', exact: true }).count(), 0);
  await login();
  await page.getByRole('button', { name: 'Kết nối USB', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kết nối USB', exact: true }).click();
  await page.getByRole('button', { name: 'Ngắt USB', exact: true }).waitFor();
  revoke = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForURL('**/login');
  await page.waitForFunction(() => window.__practiceTest.closed() >= 3);
  expiresIn = 4;
  await login();
  await page.getByRole('button', { name: 'Kết nối USB', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kết nối USB', exact: true }).click();
  await page.getByRole('button', { name: 'Ngắt USB', exact: true }).waitFor();
  await page.waitForURL('**/login');
  await page.waitForFunction(() => window.__practiceTest.closed() >= 4);
  console.log('PASS auth guard, selected-lesson return, verified reload, authorized download, logout/revocation/expiry USB cleanup');
  assert.deepEqual(errors, [], `Browser exceptions: ${errors.join('; ')}`);
  console.log(`PASS browser smoke; screenshots: ${output}`);
} finally { await browser.close(); }
