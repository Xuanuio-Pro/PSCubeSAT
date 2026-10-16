import { createContext, useContext } from 'react';

export const SerialContext = createContext(null);

export function useSerial() {
  const ctx = useContext(SerialContext);
  if (!ctx) throw new Error('useSerial must be used within SerialProvider');
  return ctx;
}

