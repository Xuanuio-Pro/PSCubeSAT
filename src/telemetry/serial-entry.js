import { adaptSerialLine } from './adapters.js';

/** Compiler/app log output may look like RX JSON, but is never device telemetry. */
export function adaptSerialEntry(entry, deviceId = 'serial-local') {
  if (entry.type !== 'rx' || entry.origin !== 'serial') return null;
  return adaptSerialLine(entry.text, deviceId, entry.receivedAt ?? Date.now());
}
