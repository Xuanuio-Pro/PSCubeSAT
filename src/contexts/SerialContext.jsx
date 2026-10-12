import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const SerialContext = createContext(null);

export function useSerial() {
  const ctx = useContext(SerialContext);
  if (!ctx) throw new Error('useSerial must be used within SerialProvider');
  return ctx;
}

export function SerialProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lines, setLines] = useState([]);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const readLoopRef = useRef(false);
  const listenersRef = useRef(new Set());

  const addLine = useCallback((text, type = 'rx') => {
    const entry = { text, type, timestamp: new Date().toLocaleTimeString() };
    setLines(prev => {
      const next = [...prev, entry];
      return next.length > 1000 ? next.slice(-500) : next;
    });
    listenersRef.current.forEach(fn => fn(entry));
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const connect = useCallback(async (baudRate = 115200) => {
    if (!('serial' in navigator)) {
      alert('Web Serial API không được hỗ trợ trên trình duyệt này. Vui lòng sử dụng Chrome hoặc Edge.');
      return false;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      writerRef.current = port.writable.getWriter();
      setIsConnected(true);
      addLine(`✅ Đã kết nối Serial (${baudRate} baud)`, 'system');

      // Read loop
      readLoopRef.current = true;
      const decoder = new TextDecoderStream();
      const inputDone = port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = { reader, inputDone };

      let buffer = '';
      (async () => {
        try {
          while (readLoopRef.current) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const parts = buffer.split('\n');
            buffer = parts.pop();
            for (const line of parts) {
              if (line.trim()) addLine(line.trim(), 'rx');
            }
          }
        } catch (err) {
          if (readLoopRef.current) addLine(`❌ Lỗi đọc Serial: ${err.message}`, 'error');
        }
      })();

      return true;
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        addLine(`❌ Lỗi kết nối: ${err.message}`, 'error');
      }
      return false;
    }
  }, [addLine]);

  const disconnect = useCallback(async () => {
    readLoopRef.current = false;
    try {
      if (readerRef.current) {
        await readerRef.current.reader.cancel();
        readerRef.current = null;
      }
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch (err) { /* ignore */ }
    setIsConnected(false);
    addLine('🔌 Đã ngắt kết nối Serial', 'system');
  }, [addLine]);

  const send = useCallback(async (text) => {
    if (!writerRef.current) return;
    try {
      const encoder = new TextEncoder();
      await writerRef.current.write(encoder.encode(text + '\n'));
      addLine(text, 'tx');
    } catch (err) {
      addLine(`❌ Lỗi gửi: ${err.message}`, 'error');
    }
  }, [addLine]);

  const clearLines = useCallback(() => setLines([]), []);

  const print = useCallback((text, type = 'system') => {
    addLine(text, type);
  }, [addLine]);

  return (
    <SerialContext.Provider value={{ isConnected, lines, connect, disconnect, send, clearLines, subscribe, print }}>
      {children}
    </SerialContext.Provider>
  );
}
