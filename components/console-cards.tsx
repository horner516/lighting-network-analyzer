'use client';
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { NodeInfo } from '@/components/device-cards';
import type { ManualDevice } from '@/lib/manual-devices';

type Signal = { id: string; protocol: string; universe: number; ip: string; priority: number | null; status: string; rate: number };

function streamRanges(streams: Signal[], showPriority = false) {
  const rows = [...new Map(streams.map(stream => [`${stream.universe}:${showPriority ? stream.priority : ''}`, stream])).values()].sort((a, b) => a.universe - b.universe);
  const groups: { start: number; end: number; priority: number | null }[] = [];
  for (const stream of rows) {
    const previous = groups.at(-1);
    if (previous && previous.end + 1 === stream.universe && (!showPriority || previous.priority === stream.priority)) previous.end = stream.universe;
    else groups.push({ start: stream.universe, end: stream.universe, priority: stream.priority });
  }
  return groups.map(group => `U${group.start}${group.end === group.start ? '' : `–${group.end}`}${showPriority ? ` · P${group.priority ?? '—'}` : ''}`);
}

export function ConsoleCards({ devices, query, info, pollingIp }: { devices: ManualDevice[]; query: string; info: Record<string, NodeInfo>; pollingIp: string }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch('/api/signals', { cache: 'no-store' });
        const result = response.ok ? await response.json() as { signals?: Signal[] } : null;
        if (!disposed) setSignals(Array.isArray(result?.signals) ? result.signals : []);
      } catch { if (!disposed) setSignals([]); }
      if (!disposed) timer = setTimeout(refresh, 1500);
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); };
  }, []);
  const consoles = devices.filter(device => device.deviceType === 'Console');
  const visible = consoles.filter(device => `${device.name} ${device.ip} ${info[device.ip]?.description || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <div><h2 className="font-semibold">Consoles <span className="text-slate-400">{consoles.length}</span></h2><p className="text-sm text-slate-400">Console identity plus output streams received by this server</p></div>
    {!visible.length && <p className="rounded-lg border border-white/10 p-8 text-center text-slate-400">{consoles.length ? 'No matching consoles.' : 'Add a console by IP to begin monitoring.'}</p>}
    {visible.map(device => {
      const node = info[device.ip];
      const active = signals.filter(signal => signal.ip === device.ip && signal.status === 'present');
      const sacn = active.filter(signal => signal.protocol === 'sACN');
      const artnet = active.filter(signal => signal.protocol === 'Art-Net');
      const sacnRanges = streamRanges(sacn, true), artnetRanges = streamRanges(artnet);
      return <section key={device.ip} className="overflow-hidden rounded-xl border border-white/15 bg-[#171d22]">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4"><div><h3 className="text-xl font-semibold">{node?.description || device.name}</h3><a href={`http://${device.ip}:8080/`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-mono text-sm text-teal-200 underline">{device.ip}:8080 <ExternalLink size={14}/></a></div><span className={`rounded-md border px-3 py-1 text-sm ${node?.responding ? 'border-teal-300/30 text-teal-200' : 'border-white/10 text-slate-400'}`}>{pollingIp === device.ip ? 'Polling…' : node?.responding ? 'Web Remote responding' : node ? 'Console unavailable' : 'Not polled'}</span></div>
        <div className="grid gap-3 border-t border-white/10 p-4 md:grid-cols-3">
          <div className="rounded-lg bg-black/15 p-4"><div className="text-sm text-slate-400">Session</div><div className="mt-2 text-lg">Not reported</div><p className="mt-2 text-xs text-slate-500">MA Web Remote does not expose a verified session name or membership state.</p></div>
          <div className="rounded-lg bg-black/15 p-4"><div className="text-sm text-slate-400">sACN output seen</div><div className="mt-2 text-2xl font-semibold">{new Set(sacn.map(stream => stream.universe)).size}</div><div className="mt-2 flex flex-wrap gap-2">{sacnRanges.map(range => <span key={range} className="rounded bg-teal-300/10 px-2 py-1 font-mono text-xs text-teal-200">{range}</span>)}</div></div>
          <div className="rounded-lg bg-black/15 p-4"><div className="text-sm text-slate-400">Art-Net output seen</div><div className="mt-2 text-2xl font-semibold">{new Set(artnet.map(stream => stream.universe)).size}</div><div className="mt-2 flex flex-wrap gap-2">{artnetRanges.map(range => <span key={range} className="rounded bg-sky-300/10 px-2 py-1 font-mono text-xs text-sky-200">{range}</span>)}</div></div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 text-sm text-slate-400">{node?.error ? <p className="text-amber-200">{node.error}</p> : <p>{node?.report || 'Waiting for console poll.'}</p>}<p className="mt-1">Active universes are inferred only from DMX packets whose source IP matches this console.</p></div>
      </section>;
    })}
  </div>;
}
