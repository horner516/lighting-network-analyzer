'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Selection = { protocol: string; universe: number; channel: number };
type Reading = Selection & { available: boolean; sampledAt: number; subscribed: boolean; listenerStatus: string; streams: { id: string; ip: string; cid: string; sourceName: string; priority: number | null; lastSeen: number; status: string; slots: number; value: number | null }[] };

export function ChannelViewer() {
  const [protocol, setProtocol] = useState('sACN');
  const [universe, setUniverse] = useState('1');
  const [channel, setChannel] = useState('1');
  const [watch, setWatch] = useState<Selection | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!watch) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function refresh() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const query = new URLSearchParams({ protocol: watch!.protocol, universe: String(watch!.universe), channel: String(watch!.channel) });
        const response = await fetch(`/api/signals/channel?${query}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Receiver unavailable');
        const next = await response.json() as Reading;
        if (!next.available || !Array.isArray(next.streams)) throw new Error('Receiver unavailable');
        if (!disposed) { setReading(next); setError(''); }
      } catch {
        if (!disposed) { setReading(null); setError('Channel receiver unavailable. Open the updated LAN app to see live values.'); }
      } finally {
        clearTimeout(timeout);
        if (!disposed) timer = setTimeout(refresh, 500);
      }
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
  }, [watch]);

  function displayValue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReading(null); setError('');
    setWatch({ protocol, universe: Number(universe), channel: Number(channel) });
  }

  return <section aria-label="Channel value viewer" className="border-b border-white/10 p-4">
    <h3 className="font-semibold">Channel value</h3>
    <form onSubmit={displayValue} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="space-y-2"><label id="channel-protocol-label" className="text-sm text-slate-400">Protocol</label><Select value={protocol} onValueChange={value => { if (value) setProtocol(value); }}><SelectTrigger aria-labelledby="channel-protocol-label" className="h-9 min-w-32 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sACN">sACN</SelectItem><SelectItem value="Art-Net">Art-Net</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><label htmlFor="watch-universe" className="text-sm text-slate-400">Universe</label><Input id="watch-universe" type="number" required min={protocol === 'sACN' ? 1 : 0} max={protocol === 'sACN' ? 63999 : 32767} step="1" value={universe} onChange={event => setUniverse(event.target.value)} className="w-32 border-white/10 font-mono" /></div>
      <div className="space-y-2"><label htmlFor="watch-channel" className="text-sm text-slate-400">Channel</label><Input id="watch-channel" type="number" required min="1" max="512" step="1" value={channel} onChange={event => setChannel(event.target.value)} className="w-28 border-white/10 font-mono" /></div>
      <Button type="submit" className="bg-teal-300 text-slate-950 hover:bg-teal-200">Display current value</Button>
      {watch && <Button type="button" variant="outline" onClick={() => { setWatch(null); setReading(null); setError(''); }}>Stop viewing</Button>}
    </form>
    <p className="mt-3 text-sm text-slate-400">Channels 1–512 · Art-Net universes use native 0-based numbering · refreshes every 0.5 seconds.</p>
    {watch && <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-4">
      <h4 className="text-sm text-teal-200">Watching {watch.protocol} · Universe {watch.universe} · Channel {watch.channel}</h4>
      {error ? <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p> : !reading ? <p role="status" className="mt-3 text-sm text-slate-400">Waiting for a reading…</p> : <>
        {!['listening', 'limited'].includes(reading.listenerStatus) && <p role="status" className="mt-3 text-sm text-amber-200">The {watch.protocol} listener is unavailable.</p>}
        {!reading.subscribed && <p className="mt-3 text-sm text-amber-200">This universe is outside the server’s sACN multicast subscriptions. Only unicast reaching the server can appear here. Add the universe to the server’s subscription range to receive multicast.</p>}
        {!reading.streams.length && <p role="status" className="mt-3 text-slate-400">— No signal received for this universe.</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{reading.streams.map(stream => <div key={stream.id} className="rounded-md border border-white/10 p-4">
          <div className="break-words text-sm text-slate-300">{stream.sourceName || stream.ip}</div>
          <div className="mt-1 break-all font-mono text-xs text-slate-500">{stream.ip}{stream.cid ? ` · ${stream.cid}` : ''}</div>
          <div className="mt-3 flex items-baseline gap-3"><span className="font-mono text-4xl text-teal-200">{stream.value ?? '—'}</span><span className="text-sm text-slate-400">{stream.value !== null ? `${(stream.value / 255 * 100).toFixed(1)}%` : stream.status === 'present' ? 'Channel not in frame' : stream.status === 'terminated' ? 'Source ended' : stream.status === 'timed-out' ? 'Signal timed out' : 'Listener unavailable'}</span></div>
          <p className="mt-3 text-sm text-slate-400">{stream.value !== null ? 'DMX value · 0–255' : 'No current value'}{stream.priority !== null ? ` · Priority ${stream.priority}` : ''}</p>
          <p className="mt-1 text-xs text-slate-500">Last packet {Math.max(0, Math.floor((reading.sampledAt - stream.lastSeen) / 1000))}s ago</p>
        </div>)}</div>
        {reading.streams.length > 1 && <p className="mt-3 text-sm text-amber-200">Multiple sources are transmitting this universe. Values are shown separately; these are not merged output levels.</p>}
      </>}
    </div>}
  </section>;
}
