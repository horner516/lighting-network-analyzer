'use client';

import { useEffect, useState } from 'react';
import { RadioTower } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type State = { available: boolean; enabled: boolean; protocol: string; universe: number; channel: number; value: number; priority: number; currentValue: number; allAtFifty: boolean; frameRate: number; error?: string };

export function SignalTransmitter() {
  const [remote, setRemote] = useState<State | null>(null);
  const [protocol, setProtocol] = useState('sACN');
  const [universe, setUniverse] = useState('1');
  const [channel, setChannel] = useState('1');
  const [value, setValue] = useState('0');
  const [priority, setPriority] = useState('100');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/transmitter', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error(); const state = await response.json() as State;
      if (!state.available) throw Error(); setRemote(state); setProtocol(state.protocol); setUniverse(String(state.universe)); setChannel(String(state.channel)); setValue(String(state.currentValue)); setPriority(String(state.priority));
    }).catch(() => setMessage('Transmitter unavailable. Open this page from the updated Lux Link LAN app.'));
    return () => controller.abort();
  }, []);

  async function update(extra: Record<string, unknown>, success: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/transmitter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol, universe: Number(universe), channel: Number(channel), value: Number(value), priority: Number(priority), ...extra }) });
      const result = await response.json() as State;
      if (!response.ok || !result.available) throw new Error(result.error || 'Transmitter unavailable.');
      setRemote(result); setProtocol(result.protocol); setUniverse(String(result.universe)); setChannel(String(result.channel)); setValue(String(result.currentValue)); setPriority(String(result.priority)); setMessage(success);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Transmitter unavailable.'); }
    finally { setBusy(false); }
  }

  const enabled = remote?.enabled === true;
  return <section aria-label="DMX transmitter" className="overflow-hidden rounded-lg border border-white/10 bg-[#171d22]">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-4">
      <div><h2 className="flex items-center gap-2 font-semibold"><RadioTower size={18} className={enabled ? 'text-emerald-400' : 'text-slate-400'}/>Transmitter</h2><p className="mt-1 text-sm text-slate-400">Generate one 512-channel sACN or Art-Net universe from this server.</p></div>
      <label className="flex items-center gap-3 text-sm"><span className={enabled ? 'text-emerald-300' : 'text-slate-400'}>{enabled ? 'Transmitting' : 'Stopped'}</span><Switch checked={enabled} disabled={!remote || busy} onCheckedChange={checked => void update({ enabled: checked }, checked ? 'Transmitter enabled.' : 'Transmitter stopped.')} aria-label="Enable transmitter" className="data-checked:bg-emerald-500"/></label>
    </div>
    <form onSubmit={event => { event.preventDefault(); void update({ setChannel: true }, `Channel ${channel} set to ${value}.`); }} className="space-y-5 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2"><label id="tx-protocol-label" className="text-sm text-slate-400">Protocol</label><Select value={protocol} onValueChange={next => { if (next) { setProtocol(next); if (next === 'sACN' && Number(universe) < 1) setUniverse('1'); } }}><SelectTrigger aria-labelledby="tx-protocol-label" className="h-9 min-w-32 border-white/10"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="sACN">sACN</SelectItem><SelectItem value="Art-Net">Art-Net</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><label htmlFor="tx-universe" className="text-sm text-slate-400">Universe</label><Input id="tx-universe" type="number" required min={protocol === 'sACN' ? 1 : 0} max={protocol === 'sACN' ? 63999 : 32767} value={universe} onChange={event => setUniverse(event.target.value)} className="w-32 border-white/10 font-mono"/></div>
        <div className="space-y-2"><label htmlFor="tx-channel" className="text-sm text-slate-400">Channel</label><Input id="tx-channel" type="number" required min="1" max="512" value={channel} onChange={event => setChannel(event.target.value)} className="w-28 border-white/10 font-mono"/></div>
        <div className="space-y-2"><label htmlFor="tx-value" className="text-sm text-slate-400">Value (0–255)</label><Input id="tx-value" type="number" required min="0" max="255" value={value} onChange={event => setValue(event.target.value)} className="w-32 border-white/10 font-mono"/></div>
        {protocol === 'sACN' && <div className="space-y-2"><label htmlFor="tx-priority" className="text-sm text-slate-400">Priority</label><Input id="tx-priority" type="number" required min="0" max="200" value={priority} onChange={event => setPriority(event.target.value)} className="w-28 border-white/10 font-mono"/></div>}
        <Button type="submit" disabled={!remote || busy} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Set channel</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/20 bg-amber-300/[.06] p-4"><Button type="button" disabled={!remote || busy} variant="outline" className="border-amber-300/30 text-amber-100" onClick={() => void update({ setAll: true }, 'All 512 channels set to 50% (DMX 128).')}>Set entire universe to 50%</Button><p className="text-sm text-slate-400">Sets channels 1–512 to DMX 128. If enabled, the change is transmitted immediately.</p></div>
      <div className="text-sm text-slate-400"><p>{enabled ? `${remote?.protocol} universe ${remote?.universe}${remote?.protocol === 'sACN' ? ` · priority ${remote?.priority}` : ''} · ${remote?.frameRate} packets/s · output active` : 'Output is off. Configure values before enabling if desired.'}</p>{message && <p role="status" className="mt-2 text-amber-200">{message}</p>}</div>
    </form>
  </section>;
}
