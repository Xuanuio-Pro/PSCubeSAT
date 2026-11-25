import { createContext, useContext } from 'react';

export const CloudContext = createContext(null);

const OFFLINE = { deviceUid: null, board: { state: 'unknown', message: '' }, photoSentAt: 0, setWifi: () => {} };

/** Hidden photo uplink state; outside CloudProvider (e.g. the public preview) nothing is uploaded. */
export function useCloud() {
  return useContext(CloudContext) ?? OFFLINE;
}

const ASK = /^\[CLOUD\] CFG\? v1 uid=(\S+) ssid=(.*)$/;

/**
 * What to answer a board that asks for its configuration.
 * - same account device and same WiFi: KEEP (no new secret);
 * - no WiFi known for this account: CLEAR a foreign config (another account's board must not keep uploading
 *   into that account), otherwise wait for the student to enter WiFi;
 * - anything else: provision this account's device.
 * @returns {'keep' | 'provision' | 'clear' | 'need-wifi' | null}
 */
export function cloudAnswer(line, { deviceUid, wifiSsid }) {
  const ask = ASK.exec(line);
  if (!ask) return null;
  const [, uid, ssid] = ask;
  if (uid !== 'none' && uid === deviceUid && (!wifiSsid || ssid === wifiSsid)) return 'keep';
  if (!wifiSsid) return uid !== 'none' && uid !== deviceUid ? 'clear' : 'need-wifi';
  return 'provision';
}
