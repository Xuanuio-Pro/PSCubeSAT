import { createContext, useContext } from 'react';

export const TelemetryContext = createContext(null);
export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('useTelemetry requires TelemetryProvider');
  return context;
}
