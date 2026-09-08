export type LiveSignal = { id: string; protocol: string; universe: number; ip: string; priority: number | null; status: string; rate: number };
export type SignalSnapshot = { available?: boolean; subscribedUniverses?: number[]; protocols?: Record<string, { status?: string }>; signals?: LiveSignal[] };
type PortSignalInput = { direction: string; active: boolean | null; outputAddress: number | null; displayUniverse?: number | null; outputProtocol: string | null };

const receiving = (status?: string) => status === 'listening' || status === 'limited';

export function portSignalPresence(port: PortSignalInput, snapshot?: SignalSnapshot | null): boolean | null {
  if (typeof port.active === 'boolean') return port.active;
  if (port.direction !== 'OUT' || !snapshot?.available) return null;
  const universe = port.outputAddress ?? port.displayUniverse;
  if (typeof universe !== 'number' || !Number.isInteger(universe)) return null;
  const configured = port.outputProtocol === 'Art-Net / sACN' ? ['Art-Net', 'sACN'] : port.outputProtocol ? [port.outputProtocol] : [];
  if (!configured.length) return null;
  const signals = Array.isArray(snapshot.signals) ? snapshot.signals : [];
  if (signals.some(signal => signal.status === 'present' && signal.universe === universe && configured.includes(signal.protocol))) return true;
  const subscribed = Array.isArray(snapshot.subscribedUniverses) ? snapshot.subscribedUniverses : [];
  const observable = configured.every(protocol => receiving(snapshot.protocols?.[protocol]?.status) && (protocol !== 'sACN' || subscribed.includes(universe)));
  return observable ? false : null;
}
