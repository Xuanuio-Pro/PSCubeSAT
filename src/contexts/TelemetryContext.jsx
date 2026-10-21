import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth, request, authorizedFetch } from './auth-api';
import { getAuthToken } from './auth-storage';
import { useSerial } from './serial-api';
import { TelemetryContext } from './telemetry-api';
import { adaptWebSocketMessage, demoFrame } from '../telemetry/adapters';
import { createPracticeDecoder } from '../telemetry/practice';
import { getLessonForLab } from '../data/curriculum';
import { createTelemetryStore, currentReadings, telemetryStatus } from '../telemetry/store';
import { startTelemetrySocket, telemetrySocketUrl } from '../telemetry/socket';

/** @typedef {{device_uid: string, device_name: string, device_type: string}} DeviceInfo */

export function TelemetryProvider({ children }) {
  const route = useLocation();
  const labId = Number(/^\/lab(\d+)$/.exec(route.pathname)?.[1] ?? 0);
  const lesson = getLessonForLab(labId, new URLSearchParams(route.search).get('lesson'));
  const exerciseId = lesson.type === 'practice' ? lesson.id : '';
  const { user } = useAuth();
  const { subscribe, isConnected, isConnecting, sessionId } = useSerial();
  const serialConnected = useRef(isConnected);
  serialConnected.current = isConnected;
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createTelemetryStore();
  const store = storeRef.current;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [devices, setDevices] = useState(/** @type {DeviceInfo[]} */ ([]));
  const [deviceError, setDeviceError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [serialBinding, setSerialBinding] = useState('serial-local');
  const identity = useRef(undefined);

  const selectSource = useCallback((mode) => {
    const id = mode === 'demo' ? 'demo' : mode === 'serial' ? serialBinding
      : devices.find(device => device.device_uid === store.getSnapshot().deviceId)?.device_uid ?? devices[0]?.device_uid ?? '';
    store.select(mode, id);
  }, [devices, serialBinding, store]);
  const selectDevice = useCallback((id) => {
    if (store.getSnapshot().mode === 'serial') setSerialBinding(id);
    store.select(store.getSnapshot().mode, id);
  }, [store]);

  useEffect(() => {
    let active = true;
    setDevices([]);
    setDeviceError('');
    if (identity.current !== user?.id) {
      identity.current = user?.id;
      store.select('serial', 'serial-local');
      setSerialBinding('serial-local');
    }
    if (user) {
      request('/api/devices').then(data => {
        if (!active) return;
        setDevices(data);
        const current = store.getSnapshot();
        if (['hardware', 'simulator'].includes(current.mode) && !data.some(device => device.device_uid === current.deviceId)) {
          store.select(current.mode, data[0]?.device_uid ?? '');
        }
      })
        .catch(error => { if (active) setDeviceError(error.message); });
    }
    return () => { active = false; };
  }, [user, store, refresh]);

  useEffect(() => {
    const timer = setInterval(store.tick, 1000);
    return () => clearInterval(timer);
  }, [store]);

  useEffect(() => {
    if (state.mode !== 'serial') return;
    store.select('serial', serialBinding);
    store.setLink(serialConnected.current ? 'connected' : 'offline');
    let generation = store.getSnapshot().generation;
    const decode = createPracticeDecoder(exerciseId);
    return subscribe(entry => {
      if (!serialConnected.current) return;
      if (store.getSnapshot().generation !== generation) return;
      if (entry.type !== 'rx' || entry.origin !== 'serial') return;
      const { frame, events, invalidate } = decode(entry, store.getSnapshot().deviceId);
      const current = store.getSnapshot();
      // Unbound USB learns its first explicit device UID, then remains isolated.
      if (frame && serialBinding === 'serial-local' && !current.latest && frame.device_id !== current.deviceId) {
        generation = store.select('serial', frame.device_id);
        store.setLink('connected');
      }
      // Explicitly bound streams cannot contribute even activity from another device.
      if (frame && frame.device_id !== store.getSnapshot().deviceId) return;
      store.observe(events, entry.receivedAt, generation);
      store.invalidate(invalidate, generation);
      if (frame) store.ingest(frame, generation);
    });
  }, [subscribe, sessionId, state.mode, serialBinding, store, user?.id, exerciseId]);

  useEffect(() => {
    if (state.mode === 'serial') store.setLink(isConnecting ? 'connecting' : isConnected ? 'connected' : 'offline');
  }, [isConnected, isConnecting, state.mode, store]);

  useEffect(() => {
    if (state.mode !== 'demo') return;
    const generation = state.generation;
    let seq = 0;
    store.setLink('connected', '', generation);
    const emit = () => store.ingest(demoFrame(Date.now(), seq++), generation);
    emit();
    const timer = setInterval(emit, 200);
    return () => clearInterval(timer);
  }, [state.mode, state.generation, store]);

  useEffect(() => {
    if (!['hardware', 'simulator'].includes(state.mode)) return;
    const generation = state.generation;
    const token = getAuthToken();
    if (!user || !token || !state.deviceId) {
      store.setLink('offline', user ? 'Chọn thiết bị để nhận telemetry.' : 'Đăng nhập để nhận telemetry qua WebSocket.', generation);
      return;
    }
    const abort = new AbortController();
    const base = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    let url;
    try { url = telemetrySocketUrl(base, state.deviceId, token); }
    catch {
      store.setLink('offline', 'Địa chỉ kết nối máy chủ không hợp lệ.', generation);
      return;
    }
    const stop = startTelemetrySocket({
      url, store, generation,
      getInitial: async () => {
        const response = await authorizedFetch(`/api/telemetry/latest/${encodeURIComponent(state.deviceId)}`, {
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]), headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          const error = Object.assign(new Error(data.message || 'Không có quyền truy cập thiết bị.'), { status: response.status });
          throw error;
        }
        return data.found ? adaptWebSocketMessage(JSON.stringify(data.data)) : null;
      },
    });
    return () => { abort.abort(); stop(); };
  }, [state.mode, state.deviceId, state.generation, user, store]);

  return <TelemetryContext.Provider value={{ ...state, latest: currentReadings(state), exerciseId, status: telemetryStatus(state, state.now),
    isCurrentSelection: generation => store.getSnapshot().generation === generation,
    devices, deviceError, serialBinding, selectSource, selectDevice, refreshDevices: () => setRefresh(value => value + 1),
  }}>{children}</TelemetryContext.Provider>;
}
