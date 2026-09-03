'use client';
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';

type Signal = { id: string; protocol: string; universe: number; ip: string; cid: string; sourceName: string; priority: number | null; status: string; lastSeen: number; rate: number; packets: number; slots: number; nonzero: number; previewLevels: number[] };
type Snapshot = { available: boolean; sampledAt: number; universeSpec: string; droppedSources: number; protocols: Record<string, { port: number; status: string; error: string; received: number; ignored: number; peakRate: number }>; memberships: { name: string; address: string; joined: number; failed: number; error: string }[]; signals: Signal[] };

export function SignalMonitor({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [state, setState] = useState('connecting');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function refresh() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch('/api/signals', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('No receiver');
        const snapshot = await response.json() as Snapshot;
        if (!snapshot.available || !Array.isArray(snapshot.signals) || !snapshot.protocols) throw new Error('No receiver');
        if (!disposed) { setData(snapshot); setState('connected'); }
      } catch {
        if (!disposed) { setState('disconnected'); setData(null); }
      } finally {
        clearTimeout(timeout);
        if (!disposed) timer = setTimeout(refresh, 1500);
      }
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
  }, []);
  const detail = data?.signals.find(s => s.id === selected);
  return <section aria-label="Network signals" className="overflow-hidden rounded-lg border border-white/10 bg-[#171d22]">
    {!compact && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><h2 className="flex items-center gap-2 font-semibold"><Radio size={18} className="text-teal-300"/>Network signals</h2><p className="mt-1 text-sm text-slate-400">sACN & Art-Net · received by this server · no lighting data transmitted</p></div><span role="status" className="text-sm text-slate-400">{state === 'connected' ? 'Receiver connected' : state === 'connecting' ? 'Connecting to receiver…' : 'Local receiver unavailable'}</span></div>}
    <div className="grid gap-3 p-4 sm:grid-cols-2">{['sACN', 'Art-Net'].map(protocol => {
      const listener = data?.protocols[protocol];
      const active = data?.signals.filter(s => s.protocol === protocol && s.status === 'present') || [];
      const running = listener && ['listening', 'limited'].includes(listener.status);
      const status = !listener ? 'Unavailable' : !running ? 'Listener error' : active.length ? 'Signal present' : 'No DMX seen';
      return <div key={protocol} className="rounded-md border border-white/10 bg-black/15 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{protocol} {!compact && <span className="text-sm text-slate-500">UDP {listener?.port || (protocol === 'sACN' ? 5568 : 6454)}</span>}</h3><span className={`text-sm ${active.length ? 'text-teal-300' : 'text-slate-400'}`}>{status}</span></div><div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"><div className="font-mono text-xl">{running ? new Set(active.map(s => s.universe)).size : '—'} <span className="font-sans text-sm text-slate-400">active universes</span></div><div className="font-mono text-xl">{running ? active.reduce((n, s) => n + s.rate, 0).toFixed(1) : '—'} <span className="font-sans text-sm text-slate-400">packets/s</span></div></div>{!compact && <p className="mt-1 text-sm text-slate-400">{running ? `${active.length} source streams · rate averaged over 5 seconds` : 'Waiting for a working local listener'}</p>}{listener?.error && <p role="alert" className="mt-2 break-words text-sm text-amber-200">{compact ? 'Limited visibility — see Network signals.' : listener.error}</p>}</div>;
    })}</div>
    <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">{['sACN', 'Art-Net'].map(protocol => <div key={protocol} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-400"><span>{protocol} peak packets/s</span><span className="font-mono text-lg text-slate-200">{data?.protocols[protocol] ? data.protocols[protocol].peakRate.toFixed(1) : '—'}</span></div>)}<p className="text-xs text-slate-500 sm:col-span-2">Peak since server start · 5-second average</p></div>
    {!data ? <p className="px-4 pb-5 text-sm text-slate-300">{state === 'connecting' ? 'Checking for the local receiver…' : compact ? 'Local receiver unavailable. Open the LAN app to see live signals.' : 'Open the dashboard served by the Windows/Mac app or LAN server. This hosted page cannot listen to your network directly.'}</p> : !compact && <>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-white/10 text-slate-400"><tr>{['Signal / universe', 'Source', 'Status', 'Packets/s', 'Slots', 'Priority', 'Last seen'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{data.signals.map(signal => <tr key={signal.id} className="border-b border-white/[.06]"><td className="px-4 py-3"><button onClick={() => setSelected(signal.id)} className="text-left text-teal-200 hover:underline">{signal.protocol} · {signal.universe}</button></td><td className="max-w-56 break-words px-4 py-3"><div>{signal.sourceName || 'Source name not supplied'}</div><div className="font-mono text-xs text-slate-400">{signal.ip}</div></td><td className={`px-4 py-3 ${signal.status === 'present' ? 'text-teal-300' : 'text-amber-200'}`}>{signal.status === 'present' ? 'Present' : signal.status === 'timed-out' ? 'Timed out' : signal.status === 'terminated' ? 'Ended by source' : 'Unavailable'}</td><td className="px-4 py-3 font-mono">{signal.rate.toFixed(1)}</td><td className="px-4 py-3 font-mono">{signal.slots}</td><td className="px-4 py-3 font-mono">{signal.priority ?? '—'}</td><td className="px-4 py-3 text-slate-400">{Math.max(0, Math.floor((data.sampledAt - signal.lastSeen) / 1000))}s ago</td></tr>)}{!data.signals.length && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No DMX streams received yet. A listening socket does not confirm that signals are present.</td></tr>}</tbody></table></div>
      {detail && <div className="border-b border-white/10 p-4 text-sm"><div className="flex justify-between gap-3"><h3>{detail.protocol} · Universe {detail.universe} · Channel values 1–16</h3><button className="text-teal-300" onClick={() => setSelected('')}>Close</button></div><p className="mt-2 break-all font-mono text-xs text-slate-400">{detail.cid ? `CID ${detail.cid} · ` : ''}{detail.packets} packets received · {detail.nonzero} nonzero slots · {detail.status === 'present' ? 'Latest received frame' : 'Historical frame; not current'}</p><div className="mt-3 flex flex-wrap gap-2">{detail.previewLevels.map((level, i) => <span key={i} className="rounded bg-black/20 px-2 py-1 font-mono"><span className="text-slate-500">{i + 1}:</span> {level}</span>)}</div></div>}
      <div className="space-y-2 p-4 text-sm text-slate-400"><p>sACN multicast subscriptions: <span className="font-mono text-slate-200">{data.universeSpec}</span>. Art-Net addresses are shown in native 0-based numbering.</p>{data.memberships.map(m => <p key={m.address}>{m.name} · {m.address} · {m.joined} groups joined{m.failed ? ` · ${m.failed} failed (${m.error})` : ''}</p>)}{data.droppedSources > 0 && <p role="alert" className="text-amber-200">Source limit reached; {data.droppedSources} packets from additional streams were omitted.</p>}<p>“Present” means valid DMX data within 3 seconds. Timed-out streams remain for 5 minutes. Preview, priority-only, sync, and discovery packets are not counted as DMX streams.</p></div>
    </>}
    {!compact && <p className="border-t border-white/10 p-4 text-sm text-slate-400">Visibility is limited to traffic reaching the server. Other VLANs and unicast addressed elsewhere may not be visible. Signal presence is not a device-health check.</p>}
  </section>;
}
