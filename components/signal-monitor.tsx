'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { ChannelViewer } from '@/components/channel-viewer';
import { SignalTransmitter } from '@/components/signal-transmitter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Signal = { id: string; protocol: string; universe: number; ip: string; cid: string; sourceName: string; priority: number | null; status: string; lastSeen: number; rate: number; packets: number; slots: number; nonzero: number; previewLevels: number[] };
type Snapshot = { available: boolean; sampledAt: number; universeSpec: string; droppedSources: number; protocols: Record<string, { port: number; status: string; error: string; received: number; ignored: number; peakRate: number }>; memberships: { name: string; address: string; joined: number; failed: number; error: string }[]; signals: Signal[] };
type NetworkSelection = { available: boolean; selected: string; interfaces: { name: string; address: string }[]; transmitterEnabled: boolean };
type RangeReading = { available: boolean; sampledAt: number; protocol: string; universe: number; start: number; end: number; streams: { id: string; status: string; slots: number; values: (number | null)[] }[] };

function universeRanges(signals: Signal[]) {
  const universes = [...new Set(signals.map(signal => signal.universe))].sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [];
  for (const universe of universes) {
    const previous = ranges.at(-1);
    if (previous && previous.end + 1 === universe) previous.end = universe;
    else ranges.push({ start: universe, end: universe });
  }
  return ranges.map(range => range.start === range.end ? `${range.start}` : `${range.start}–${range.end}`).join(', ');
}

function sourceLabel(signals: Signal[], ip: string) {
  return signals.find(signal => signal.sourceName)?.sourceName || `Device ${ip}`;
}

function StreamChannelValues({ signal }: { signal: Signal }) {
  const pageSize = 16;
  const lastPage = 497;
  const [start, setStart] = useState(1);
  const [reading, setReading] = useState<RangeReading | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function refresh() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const query = new URLSearchParams({ protocol: signal.protocol, universe: String(signal.universe), start: String(start), count: String(pageSize) });
        const response = await fetch(`/api/signals/channels?${query}`, { cache:'no-store', signal:controller.signal });
        if (!response.ok) throw Error();
        const next = await response.json() as RangeReading;
        if (!next.available || !Array.isArray(next.streams)) throw Error();
        if (!disposed) { setReading(next); setError(''); }
      } catch {
        if (!disposed) { setReading(null); setError('Channel values unavailable.'); }
      } finally {
        clearTimeout(timeout);
        if (!disposed) timer = setTimeout(refresh, 500);
      }
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
  }, [signal.protocol, signal.universe, start]);
  const stream = reading?.streams.find(item => item.id === signal.id);
  const values = stream?.values || Array(pageSize).fill(null);
  function move(next: number) { setReading(null); setError(''); setStart(Math.min(lastPage, Math.max(1, next))); }
  return <div className="mt-4 border-t border-white/10 pt-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h5 className="font-medium text-slate-200">Read values · Channels {start}–{Math.min(512, start + pageSize - 1)}</h5>
      <div className="flex items-center gap-2" role="group" aria-label="Channel range">
        <Button type="button" size="sm" variant="outline" disabled={start === 1} onClick={() => move(start - pageSize)} aria-label="Previous 16 channels"><ChevronLeft size={16}/>Previous</Button>
        <span className="min-w-24 text-center font-mono text-xs text-slate-400">{start}–{Math.min(512, start + pageSize - 1)} / 512</span>
        <Button type="button" size="sm" variant="outline" disabled={start >= lastPage} onClick={() => move(start + pageSize)}>Next<ChevronRight size={16}/></Button>
      </div>
    </div>
    <input aria-label="Choose channel range" className="mt-3 w-full accent-teal-300" type="range" min="1" max={lastPage} step={pageSize} value={start} onChange={event => move(Number(event.target.value))}/>
    {error ? <p role="alert" className="mt-3 text-amber-200">{error}</p> : !reading ? <p role="status" className="mt-3 text-slate-400">Reading channels…</p> : <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-16">{values.map((level, index) => <div key={start + index} className="rounded bg-black/25 px-2 py-2 text-center font-mono"><div className="text-xs text-slate-500">{start + index}</div><div className="mt-1 text-slate-100">{level ?? '—'}</div></div>)}</div>}
  </div>;
}

function Receiver({ compact = false }: { compact?: boolean }) {
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
  const devices = data ? [...new Set(data.signals.map(signal => signal.ip))].map(ip => ({ ip, signals: data.signals.filter(signal => signal.ip === ip) })) : [];
  return <section aria-label="Network" className="overflow-hidden rounded-lg border border-white/10 bg-[#171d22]">
    {!compact && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><h2 className="flex items-center gap-2 font-semibold"><Radio size={18} className="text-teal-300"/>Receiver</h2><p className="mt-1 text-sm text-slate-400">sACN & Art-Net traffic received by this server</p></div><span role="status" className="text-sm text-slate-400">{state === 'connected' ? 'Receiver connected' : state === 'connecting' ? 'Connecting to receiver…' : 'Local receiver unavailable'}</span></div>}
    {!compact && <ChannelViewer />}
    <div className="grid gap-3 p-4 sm:grid-cols-2">{['sACN', 'Art-Net'].map(protocol => {
      const listener = data?.protocols[protocol];
      const active = data?.signals.filter(s => s.protocol === protocol && s.status === 'present') || [];
      const running = listener && ['listening', 'limited'].includes(listener.status);
      const status = !listener ? 'Unavailable' : !running ? 'Listener error' : active.length ? 'Signal present' : 'No DMX seen';
      return <div key={protocol} className="rounded-md border border-white/10 bg-black/15 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{protocol} {!compact && <span className="text-sm text-slate-500">UDP {listener?.port || (protocol === 'sACN' ? 5568 : 6454)}</span>}</h3><span className={`text-sm ${active.length ? 'text-teal-300' : 'text-slate-400'}`}>{status}</span></div><div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"><div className="font-mono text-xl">{running ? new Set(active.map(s => s.universe)).size : '—'} <span className="font-sans text-sm text-slate-400">active universes</span></div><div className="font-mono text-xl">{running ? active.reduce((n, s) => n + s.rate, 0).toFixed(1) : '—'} <span className="font-sans text-sm text-slate-400">packets/s</span></div></div>{!compact && <p className="mt-1 text-sm text-slate-400">{running ? `${active.length} source streams · rate averaged over 5 seconds` : 'Waiting for a working local listener'}</p>}{listener?.error && <p role="alert" className="mt-2 break-words text-sm text-amber-200">{compact ? 'Limited visibility — see Network signals.' : listener.error}</p>}</div>;
    })}</div>
    <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">{['sACN', 'Art-Net'].map(protocol => <div key={protocol} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-400"><span>{protocol} peak packets/s</span><span className="font-mono text-lg text-slate-200">{data?.protocols[protocol] ? data.protocols[protocol].peakRate.toFixed(1) : '—'}</span></div>)}<p className="text-xs text-slate-500 sm:col-span-2">Peak since server start · 5-second average</p></div>
    {!data ? <p className="px-4 pb-5 text-sm text-slate-300">{state === 'connecting' ? 'Checking for the local receiver…' : compact ? 'Local receiver unavailable. Open the LAN app to see live signals.' : 'Open the dashboard served by the Windows/Mac app or LAN server. This hosted page cannot listen to your network directly.'}</p> : !compact && <>
      <div className="space-y-3 border-y border-white/10 p-4">{devices.map(device => {
        const summaries = ['sACN', 'Art-Net'].map(protocol => ({ protocol, signals: device.signals.filter(signal => signal.protocol === protocol) })).filter(group => group.signals.length);
        return <section key={device.ip} className="overflow-hidden rounded-lg border border-white/10 bg-black/15">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-4"><div><h3 className="font-semibold text-slate-100">{sourceLabel(device.signals, device.ip)}</h3><p className="mt-1 font-mono text-sm text-slate-400">{device.ip}</p></div><div className="text-right text-sm text-slate-400"><p>{device.signals.filter(signal => signal.status === 'present').length} active universes</p><p>{device.signals.reduce((total, signal) => total + signal.rate, 0).toFixed(1)} packets/s</p></div></div>
          <div className="space-y-4 p-4">{summaries.map(group => <div key={group.protocol}><p className={`mb-2 font-mono text-sm ${group.protocol === 'sACN' ? 'text-teal-200' : 'text-sky-200'}`}>{group.protocol} · {universeRanges(group.signals)}</p><div className="space-y-2">{group.signals.sort((a, b) => a.universe - b.universe).map(signal => <div key={signal.id}>
            <button type="button" aria-expanded={selected === signal.id} onClick={() => setSelected(current => current === signal.id ? '' : signal.id)} className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${selected === signal.id ? 'border-teal-300/40 bg-teal-300/10' : 'border-white/[.07] bg-white/[.025] hover:border-white/20'}`}><span><span className="font-mono">Universe {signal.universe}</span>{signal.priority !== null && <span className="ml-3 text-sm text-slate-400">Priority {signal.priority}</span>}</span><span className={`text-sm ${signal.status === 'present' ? 'text-teal-300' : 'text-amber-200'}`}>{signal.status === 'present' ? 'Present' : signal.status === 'timed-out' ? 'Timed out' : signal.status === 'terminated' ? 'Ended' : 'Unavailable'}</span></button>
            {selected === signal.id && detail && <div className="mx-2 rounded-b-md border-x border-b border-white/10 bg-[#11171b] p-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><h4>{detail.protocol} · Universe {detail.universe}</h4><button className="text-teal-300 hover:underline" onClick={() => setSelected('')}>Close</button></div><div className="mt-2 grid gap-2 text-slate-400 sm:grid-cols-4"><span>{detail.rate.toFixed(1)} packets/s</span><span>{detail.slots} slots</span><span>{detail.nonzero} nonzero</span><span>{Math.max(0, Math.floor((data.sampledAt - detail.lastSeen) / 1000))}s ago</span></div><p className="mt-2 break-all font-mono text-xs text-slate-500">{detail.cid ? `CID ${detail.cid} · ` : ''}{detail.packets} packets received · {detail.status === 'present' ? 'latest received frame' : 'historical frame; not current'}</p><StreamChannelValues key={detail.id} signal={detail}/></div>}
          </div>)}</div></div>)}</div>
        </section>;
      })}{!devices.length && <p className="p-4 text-center text-sm text-slate-400">No DMX streams received yet. A listening socket does not confirm that signals are present.</p>}</div>
      <div className="space-y-2 p-4 text-sm text-slate-400"><p>sACN multicast subscriptions: <span className="font-mono text-slate-200">{data.universeSpec}</span>. Art-Net addresses are shown in native 0-based numbering.</p>{data.memberships.map(m => <p key={m.address}>{m.name} · {m.address} · {m.joined} groups joined{m.failed ? ` · ${m.failed} failed (${m.error})` : ''}</p>)}{data.droppedSources > 0 && <p role="alert" className="text-amber-200">Source limit reached; {data.droppedSources} packets from additional streams were omitted.</p>}<p>“Present” means valid DMX data within 3 seconds. Timed-out streams remain for 5 minutes. Preview, priority-only, sync, and discovery packets are not counted as DMX streams.</p></div>
    </>}
    {!compact && <p className="border-t border-white/10 p-4 text-sm text-slate-400">Visibility is limited to traffic reaching the server. Other VLANs and unicast addressed elsewhere may not be visible. Signal presence is not a device-health check.</p>}
  </section>;
}

export function SignalMonitor({ compact = false }: { compact?: boolean }) {
  if (compact) return <Receiver compact/>;
  return <NetworkWorkspace/>;
}

function NetworkWorkspace() {
  const [network, setNetwork] = useState<NetworkSelection | null>(null);
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/network-interface', { cache: 'no-store', signal: controller.signal }).then(response => {
      if (!response.ok) throw Error(); return response.json() as Promise<NetworkSelection>;
    }).then(setNetwork).catch(() => setNetwork(null));
    return () => controller.abort();
  }, []);
  async function select(address: string) {
    setChanging(true); setMessage('Changing network connection…');
    try {
      const response = await fetch('/api/network-interface', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: address === 'all' ? '' : address }) });
      const result = await response.json() as NetworkSelection & { error?: string };
      if (!response.ok) throw Error(result.error || 'Unable to select that connection.');
      setNetwork(result); setRevision(value => value + 1);
      setMessage(`Receiver restarted on ${result.selected || 'all active connections'}. Transmit output remains off.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to select that connection.'); }
    finally { setChanging(false); }
  }
  return <div className="space-y-4">
    <section className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-white/10 bg-[#171d22] p-4">
      <div><label className="text-sm text-slate-400">Network connection</label><Select value={network?.selected || 'all'} onValueChange={value => { if (value) void select(value); }} disabled={!network || changing}><SelectTrigger className="mt-2 w-[min(28rem,80vw)] border-white/10 bg-black/15"><SelectValue placeholder="Select a network connection"/></SelectTrigger><SelectContent><SelectItem value="all">All active connections</SelectItem>{network?.interfaces.map(item => <SelectItem key={`${item.name}-${item.address}`} value={item.address}>{item.name} · {item.address}</SelectItem>)}</SelectContent></Select></div>
      <div className="max-w-xl text-sm text-slate-400"><p>{network ? 'This connection is used for both DMX receiving and transmitting.' : 'Connection selection is available in the local Lux Link app.'}</p>{message && <p role="status" className="mt-1 text-amber-200">{message}</p>}</div>
    </section>
    <Tabs defaultValue="receiver" className="gap-4"><TabsList aria-label="Network mode" className="bg-[#1b252c] text-slate-100"><TabsTrigger value="receiver" className="px-5 text-slate-300 data-active:bg-teal-300/15 data-active:text-teal-200">Receiver</TabsTrigger><TabsTrigger value="transmit" className="px-5 text-slate-300 data-active:bg-teal-300/15 data-active:text-teal-200">Transmit</TabsTrigger></TabsList><TabsContent value="receiver"><Receiver key={`rx-${revision}`}/></TabsContent><TabsContent value="transmit"><SignalTransmitter key={`tx-${revision}`}/></TabsContent></Tabs>
  </div>;
}
