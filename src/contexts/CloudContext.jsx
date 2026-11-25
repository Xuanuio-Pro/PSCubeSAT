import { useCallback, useEffect, useRef, useState } from 'react';
import { request, useAuth } from './auth-api';
import { useSerial } from './serial-api';
import { CloudContext, cloudAnswer } from './cloud-api';

// A board only reads "@PTITCLOUD ?" while its sketch reads cdh; the boot handshake is the reliable path.
const QUERY_AFTER_CONNECT_MS = 2500;

/**
 * Hidden photo uplink: answers the platform library's "[CLOUD] CFG?" handshake over Serial with this account's
 * WiFi + MQTT settings (fetched from the server, never shown in the Serial Monitor), so a board publishes
 * every photo it saves to the server and the Camera Viewer can show it. Students write no upload code.
 */
export function CloudProvider({ children }) {
  const { user } = useAuth();
  const { subscribe, send, isConnected, sessionId } = useSerial();
  const [status, setStatus] = useState({ loaded: false, deviceUid: null, wifiSsid: '' });
  const [board, setBoard] = useState({ state: 'unknown', message: '' });
  const [photoSentAt, setPhotoSentAt] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  // WiFi typed by the student for their own network: kept in memory only; the board stores it in NVS.
  const ownWifi = useRef(/** @type {{ ssid: string, password: string } | null} */ (null));
  const asked = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    request('/api/devices/cloud')
      .then(data => { if (active) setStatus({ loaded: true, deviceUid: data.device_uid, wifiSsid: data.wifi_ssid || '' }); })
      .catch(() => { if (active) setStatus(current => ({ ...current, loaded: true })); });
    return () => { active = false; };
  }, [user]);

  const provision = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setBoard({ state: 'configuring', message: 'Đang cấu hình bo để gửi ảnh lên máy chủ…' });
    try {
      const wifi = ownWifi.current;
      const config = await request('/api/devices/cloud/provision', {
        method: 'POST', body: JSON.stringify(wifi ? { wifi_ssid: wifi.ssid, wifi_password: wifi.password } : {}),
      });
      setStatus(current => ({ ...current, deviceUid: config.uid }));
      await send(`@PTITCLOUD ${JSON.stringify(config)}`, { display: `☁️ Đã gửi cấu hình gửi ảnh cho bo (WiFi "${config.ssid}")` });
    } catch (error) {
      const reason = error?.details?.reason;
      setBoard(reason === 'wifi_missing'
        ? { state: 'need-wifi', message: 'Chưa có WiFi cho bo. Nhập WiFi để bo gửi ảnh lên máy chủ.' }
        : { state: 'error', message: error.message || 'Không lấy được cấu hình từ máy chủ.' });
    } finally {
      busy.current = false;
    }
  }, [send]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribe(entry => {
      if (entry.type !== 'rx' || entry.origin !== 'serial' || !entry.text.startsWith('[CLOUD] ')) return;
      const text = entry.text;
      const current = statusRef.current;
      const answer = cloudAnswer(text, { deviceUid: current.deviceUid, wifiSsid: ownWifi.current?.ssid || current.wifiSsid });
      if (answer) asked.current = true;
      if (answer === 'keep') {
        send('@PTITCLOUD KEEP', { display: null });
        setBoard({ state: 'configured', message: 'Bo đã sẵn sàng gửi ảnh lên máy chủ.' });
      } else if (answer === 'provision') {
        provision();
      } else if (answer === 'clear' || answer === 'need-wifi') {
        if (answer === 'clear') send('@PTITCLOUD CLEAR', { display: null });
        setBoard({ state: 'need-wifi', message: 'Chưa có WiFi cho bo. Nhập WiFi để bo gửi ảnh lên máy chủ.' });
      } else if (/^\[CLOUD\] CFG OK/.test(text)) {
        setBoard({ state: 'configured', message: 'Bo đã sẵn sàng gửi ảnh lên máy chủ.' });
      } else if (/^\[CLOUD\] CFG ERR/.test(text)) {
        setBoard({ state: 'error', message: 'Bo từ chối cấu hình gửi ảnh. Thử nhấn RST trên bo.' });
      } else if (/^\[CLOUD\] PHOTO SENT /.test(text)) {
        setPhotoSentAt(Date.now());
      }
    });
  }, [user, subscribe, send, provision]);

  // Boards that were already running when the port opened did not see the boot handshake.
  useEffect(() => {
    asked.current = false;
    if (!user || !isConnected) return undefined;
    const timer = setTimeout(() => { if (!asked.current) send('@PTITCLOUD ?', { display: null }); }, QUERY_AFTER_CONNECT_MS);
    return () => clearTimeout(timer);
  }, [user, isConnected, sessionId, send]);

  const setWifi = useCallback((ssid, password) => {
    ownWifi.current = ssid ? { ssid, password } : null;
    if (isConnected) provision();
  }, [isConnected, provision]);

  return <CloudContext.Provider value={{ deviceUid: status.deviceUid, board, photoSentAt, setWifi }}>{children}</CloudContext.Provider>;
}
