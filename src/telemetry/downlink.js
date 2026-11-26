// Lab5-01 downlink seen at the ground station: "PACKET #n - CUBESAT TELEMETRY", one packet every 2 s.
const PACKET = /\bPACKET #(\d+)\b/;

export const emptyPackets = { packets: 0, firstPacket: null, lastPacket: null };

/**
 * Running downlink totals; the packet numbers give an estimate of packets lost on the air.
 * A number not above the previous one means the satellite restarted: counting starts again from it.
 * @template {{ packets: number, firstPacket: number | null, lastPacket: number | null }} T
 * @param {T} stats
 * @param {string} text one line received by the ground station
 * @returns {T}
 */
export function countPacket(stats, text) {
  const match = PACKET.exec(text);
  if (!match) return stats;
  const number = Number(match[1]);
  const restarted = stats.lastPacket === null || number <= stats.lastPacket;
  return { ...stats, packets: restarted ? 1 : stats.packets + 1, firstPacket: restarted ? number : stats.firstPacket, lastPacket: number };
}

/** @param {{ packets: number, firstPacket: number | null, lastPacket: number | null }} stats */
export const lostPackets = stats => stats.lastPacket === null || stats.firstPacket === null ? null : stats.lastPacket - stats.firstPacket + 1 - stats.packets;
