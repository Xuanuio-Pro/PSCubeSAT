import { createContext, useContext } from 'react';

export const CloudContext = createContext(null);

const OFFLINE = { deviceUid: null, board: { state: 'unknown', message: '' }, photoSentAt: 0, setWifi: () => {} };

/** Hidden photo uplink state; outside CloudProvider (e.g. the public preview) nothing is uploaded. */
export function useCloud() {
  return useContext(CloudContext) ?? OFFLINE;
}

// Firmware since uplink v10 also reports "host=<host>:<port>"; older images omit it.
const ASK = /^\[CLOUD\] CFG\? v1 uid=(\S+)(?: host=(\S+))? ssid=(.*)$/;

/**
 * What to answer a board that asks for its configuration.
 * - same account device, same WiFi and same MQTT broker: KEEP (no new secret). A board that does not report
 *   its broker (older image) or reports another one is provisioned again, so it never keeps a retired broker;
 * - no WiFi known for this account: CLEAR a foreign config (another account's board must not keep uploading
 *   into that account), otherwise wait for the student to enter WiFi;
 * - anything else: provision this account's device.
 * @returns {'keep' | 'provision' | 'clear' | 'need-wifi' | null}
 */
export function cloudAnswer(line, { deviceUid, wifiSsid, broker = null }) {
  const ask = ASK.exec(line);
  if (!ask) return null;
  const [, uid, host, ssid] = ask;
  const sameBroker = !broker || host === broker;
  if (uid !== 'none' && uid === deviceUid && (!wifiSsid || ssid === wifiSsid) && sameBroker) return 'keep';
  if (!wifiSsid) return uid !== 'none' && uid !== deviceUid ? 'clear' : 'need-wifi';
  return 'provision';
}
