import { adaptWebSocketMessage } from './adapters.js';

export function telemetrySocketUrl(base, deviceId, token) {
  const url = new URL(`${base.replace(/\/$/, '')}/devices/${encodeURIComponent(deviceId)}`);
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('WebSocket URL must use ws/wss');
  url.searchParams.set('token', token);
  return url.toString();
}

/** Reconnect with a fresh authorization/cache check; cleanup invalidates every callback. */
export function startTelemetrySocket({ url, store, generation, getInitial,
  Socket = WebSocket, schedule = setTimeout, cancel = clearTimeout,
  repeat = setInterval, clearRepeat = clearInterval }) {
  let active = true;
  let socket;
  let retry;
  let heartbeat;
  let failures = 0;
  function reconnect(error) {
    if (!active) return;
    store.setLink('offline', error, generation);
    retry = schedule(connect, Math.min(1000 * 2 ** failures++, 10000));
  }
  async function connect() {
    if (!active) return;
    store.setLink('connecting', '', generation);
    try {
      const frame = await getInitial();
      if (!active) return;
      if (frame) store.ingest(frame, generation);
      const current = new Socket(url);
      socket = current;
      const isCurrent = () => active && socket === current;
      current.onopen = () => {
        if (!isCurrent()) return;
        failures = 0;
        store.setLink('connected', '', generation);
        heartbeat = repeat(() => {
          if (isCurrent() && current.readyState === 1) current.send('ping');
        }, 10000);
      };
      current.onmessage = (event) => {
        if (!isCurrent() || typeof event.data !== 'string') return;
        const frame = adaptWebSocketMessage(event.data);
        if (frame) store.ingest(frame, generation);
      };
      current.onerror = () => { if (isCurrent()) store.setLink('offline', 'Lỗi kết nối WebSocket.', generation); };
      current.onclose = (event) => {
        if (!isCurrent()) return;
        clearRepeat(heartbeat);
        if ([1000, 1008].includes(event.code)) {
          store.setLink('offline', event.code === 1008 ? 'Phiên hoặc quyền truy cập đã thay đổi. Đăng nhập/chọn lại thiết bị.' : 'Kết nối đã đóng.', generation);
          return;
        }
        reconnect('Mất kết nối. Đang kết nối lại...');
      };
    } catch (error) {
      if (!active) return;
      if ([401, 403, 404].includes(error.status)) {
        store.setLink('offline', error.message, generation);
      } else {
        reconnect('Không kết nối được backend. Đang thử lại...');
      }
    }
  }
  connect();
  return () => {
    active = false;
    cancel(retry);
    clearRepeat(heartbeat);
    if (socket) {
      socket.onclose = null;
      socket.close(1000);
    }
  };
}
