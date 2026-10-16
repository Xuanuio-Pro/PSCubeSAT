import { useState, useRef, useCallback, useEffect } from 'react';
import { SerialContext } from './serial-api';

export function SerialProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const [lines, setLines] = useState([]);
  const [builds, setBuilds] = useState({});
  const [boards, setBoards] = useState({});
  const [isFlashing, setIsFlashing] = useState(false);
  const flashRef = useRef(false);
  const activeRef = useRef(null);
  const connectingRef = useRef(false);
  const mountedRef = useRef(true);
  const listenersRef = useRef(new Set());

  const addLine = useCallback((text, type = 'rx', origin = 'app') => {
    if (!mountedRef.current) return;
    const entry = { text, type, origin, timestamp: new Date().toLocaleTimeString(), receivedAt: Date.now() };
    setLines(previous => [...previous, entry].slice(-500));
    listenersRef.current.forEach(listener => listener(entry));
  }, []);
  const subscribe = useCallback(listener => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const disconnect = useCallback(async () => {
    const session = activeRef.current;
    if (!session) return;
    session.stopping = true;
    try { await session.reader?.cancel(); } catch { /* USB may already be gone. */ }
    await session.readDone;
    addLine('Đã ngắt kết nối Serial.', 'system');
  }, [addLine]);

  const connect = useCallback(async (baudRate = 115200, existingPort = null) => {
    if (connectingRef.current || activeRef.current || flashRef.current) return false;
    if (!window.isSecureContext) {
      addLine('Trình duyệt chặn Serial trên HTTP qua IP mạng. Mở localhost trên máy cắm USB hoặc dùng HTTPS có chứng chỉ được tin cậy.', 'error');
      return false;
    }
    if (!navigator.serial) {
      addLine('Web Serial yêu cầu Chrome/Edge và HTTPS hoặc localhost.', 'error');
      return false;
    }
    connectingRef.current = true;
    setIsConnecting(true);
    let port;
    let writer;
    try {
      port = existingPort || await navigator.serial.requestPort();
      if (!mountedRef.current) return false;
      await port.open({ baudRate });
      writer = port.writable.getWriter();
      const decoder = new TextDecoderStream();
      const inputDone = port.readable.pipeTo(/** @type {WritableStream<Uint8Array>} */ (decoder.writable));
      inputDone.catch(() => {}); // Teardown below still awaits the settled pipeline.
      const reader = decoder.readable.getReader();
      const session = { port, writer, reader, inputDone, readDone: null, stopping: false };
      activeRef.current = session;
      setIsConnected(true);
      setSessionId(value => value + 1);
      addLine(`Serial đã kết nối (${baudRate} baud).`, 'system');
      session.readDone = (async () => {
        let buffer = '';
        let discard = false;
        try {
          while (!session.stopping) {
            const { value, done } = await reader.read();
            if (done) break;
            let chunk = value;
            if (discard) {
              const boundary = chunk.indexOf('\n');
              if (boundary < 0) continue;
              chunk = chunk.slice(boundary + 1);
              discard = false;
            }
            buffer += chunk;
            const parts = buffer.split('\n');
            buffer = parts.pop() ?? '';
            for (const line of parts) {
              if (line.length <= 65536 && line.trim()) addLine(line.trim(), 'rx', 'serial');
            }
            if (buffer.length > 65536) { buffer = ''; discard = true; }
          }
        } catch (error) {
          if (!session.stopping) addLine(`Mất Serial: ${error.message}`, 'error');
        } finally {
          reader.releaseLock();
          session.reader = null;
          await inputDone.catch(() => {});
          writer.releaseLock();
          await port.close().catch(() => {});
          if (activeRef.current === session) {
            activeRef.current = null;
            if (mountedRef.current) setIsConnected(false);
          }
        }
      })();
      return true;
    } catch (error) {
      try { writer?.releaseLock(); await port?.close(); } catch { /* Unopened/cancelled port. */ }
      if (error.name !== 'NotFoundError') addLine(`Không kết nối được Serial: ${error.message}`, 'error');
      return false;
    } finally {
      connectingRef.current = false;
      if (mountedRef.current) setIsConnecting(false);
    }
  }, [addLine]);

  const selectBoard = useCallback((labId, board) => {
    setBoards(previous => ({ ...previous, [labId]: board }));
    setBuilds(previous => ({ ...previous, [labId]: null }));
  }, []);

  const saveBuild = useCallback((labId, build) => {
    setBuilds(previous => ({ ...previous, [labId]: build }));
  }, []);

  const withFlashPort = useCallback(async operation => {
    if (flashRef.current || connectingRef.current) throw new Error('Cổng Serial đang bận.');
    if (!window.isSecureContext) throw new Error('HTTP qua IP mạng không được phép nạp USB. Dùng localhost trên máy cắm board hoặc HTTPS có chứng chỉ được tin cậy.');
    if (!navigator.serial) throw new Error('Cần Chrome/Edge trên HTTPS hoặc localhost để nạp.');
    flashRef.current = true;
    setIsFlashing(true);
    let port;
    try {
      // requestPort must run directly from the user's click, before network awaits.
      port = activeRef.current?.port || await navigator.serial.requestPort();
      await disconnect();
      await operation(port);
    } finally {
      flashRef.current = false;
      if (mountedRef.current) setIsFlashing(false);
      if (port && mountedRef.current) {
        const connected = await connect(115200, port);
        if (!connected) addLine('Cổng có thể đổi sau reset. Bấm Kết nối Serial để chọn lại cổng.', 'system');
      }
    }
  }, [connect, disconnect, addLine]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; disconnect(); };
  }, [disconnect]);

  const send = useCallback(async text => {
    const session = activeRef.current;
    if (!session || session.stopping || flashRef.current) return false;
    try {
      await session.writer.write(new TextEncoder().encode(text + '\n'));
      addLine(text, 'tx');
      return true;
    } catch (error) {
      addLine(`Lỗi gửi Serial: ${error.message}`, 'error');
      return false;
    }
  }, [addLine]);
  const clearLines = useCallback(() => setLines([]), []);
  const print = useCallback((text, type = 'system') => addLine(text, type), [addLine]);

  return <SerialContext.Provider value={{ isConnected, isConnecting, isFlashing, sessionId, lines,
    builds, boards, selectBoard, saveBuild, withFlashPort, connect, disconnect, send, clearLines, subscribe, print }}>{children}</SerialContext.Provider>;
}
