'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronRight, CircleDot, Clock3, Command, Gauge, Network, Plus, Radio, RefreshCw, Search, Server, Settings2, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type State = 'Healthy' | 'Warning' | 'Offline';
type Device = { name:string; model:string; vendor:string; ip:string; protocol:string; universes:string; state:State; detail:string; traffic:number; last:string };

const devices: Device[] = [
  { name:'FOH MA3', model:'grandMA3 full-size', vendor:'MA Lighting', ip:'10.101.1.10', protocol:'MA-Net3 · sACN', universes:'1–64', state:'Healthy', detail:'Primary session · Station 1', traffic:82, last:'now' },
  { name:'Stage Left A', model:'ProPlex IQ Two 8', vendor:'TMB', ip:'10.101.2.21', protocol:'sACN · Art-Net', universes:'1–8', state:'Healthy', detail:'A/B links active · 42°C', traffic:64, last:'1s' },
  { name:'Stage Right A', model:'NETRON EN12', vendor:'Obsidian', ip:'10.101.2.22', protocol:'sACN · Art-Net', universes:'9–20', state:'Warning', detail:'Port 7: no DMX output', traffic:48, last:'2s' },
  { name:'Backup Console', model:'ETC Eos Apex 10', vendor:'ETC', ip:'10.101.1.12', protocol:'sACN', universes:'1–64', state:'Healthy', detail:'Backup · synchronized', traffic:12, last:'now' },
  { name:'Dimmer Beach', model:'ProPlex IQ One+ Mini', vendor:'TMB', ip:'10.101.2.31', protocol:'sACN', universes:'21–24', state:'Healthy', detail:'PoE · 39°C', traffic:35, last:'1s' },
  { name:'LED Wall Node', model:'NETRON EP4', vendor:'Obsidian', ip:'10.101.2.44', protocol:'Art-Net', universes:'41–44', state:'Offline', detail:'Last response 07:42:16', traffic:0, last:'4m' },
];

const statusStyle: Record<State,string> = { Healthy:'bg-emerald-400', Warning:'bg-amber-400', Offline:'bg-rose-500' };
const savedDevicesKey = 'lux-link-manual-devices';
const clamp = (value: number) => Math.max(0, Math.floor(value));

function parseUniverseCount(universes: string) {
  const normalized = universes.replace(/\s/g, '');
  if (!normalized || normalized === '—' || normalized === '-') return 0;

  const rangeMatch = /^(\d+)[–-](\d+)$/.exec(normalized);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    return start <= end ? clamp(end - start + 1) : 0;
  }

  if (normalized.includes(',')) {
    return normalized.split(',').filter(Boolean).length;
  }

  return /^\d+$/.test(normalized) ? 1 : 0;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [deviceList, setDeviceList] = useState(devices);
  const [selected, setSelected] = useState(devices[2]);
  const [addOpen, setAddOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [serverUrl, setServerUrl] = useState('...');
  const visible = useMemo(() => deviceList.filter(d => (filter === 'All' || d.state === filter) && `${d.name} ${d.model} ${d.ip} ${d.protocol}`.toLowerCase().includes(query.toLowerCase())), [deviceList, query, filter]);
  const onlineCount = useMemo(() => deviceList.filter(d => d.state !== 'Offline').length, [deviceList]);
  const offlineCount = useMemo(() => deviceList.filter(d => d.state === 'Offline').length, [deviceList]);
  const alerts = useMemo(() => deviceList.filter(d => d.state !== 'Healthy'), [deviceList]);
  const activeUniverseCount = useMemo(() => deviceList.reduce((sum, device) => sum + parseUniverseCount(device.universes), 0), [deviceList]);
  const networkHealth = useMemo(() => {
    if (!deviceList.length) return 0;
    return Math.round((onlineCount / deviceList.length) * 100);
  }, [deviceList.length, onlineCount]);
  const actionNeededLabel = `${alerts.length} action${alerts.length === 1 ? '' : 's'} needed`;
  const alertCardTitle = alerts.length ? `${alerts.length} item${alerts.length === 1 ? '' : 's'} need attention` : 'No items need attention';

  function addDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ip = newIp.trim();
    if (!isValidIpv4(ip)) { setAddError('Enter a valid IPv4 address, such as 10.101.2.50.'); return; }
    if (deviceList.some(device => device.ip === ip)) { setAddError('That IP address is already in the device list.'); return; }
    const device: Device = { name: newName.trim() || `Device ${ip}`, model:'Manually added device', vendor:'Unknown', ip, protocol:'Awaiting discovery', universes:'—', state:'Warning', detail:'Manual entry · awaiting response', traffic:0, last:'Not seen' };
    setDeviceList(current => {
      const next = [...current, device];
      try { localStorage.setItem(savedDevicesKey, JSON.stringify(next.filter(item => item.model === 'Manually added device'))); } catch {}
      return next;
    });
    setSelected(device);
    setFilter('All');
    setQuery('');
    setNewIp('');
    setNewName('');
    setAddError('');
    setAddOpen(false);
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(savedDevicesKey) ?? '[]') as Device[];
      if (Array.isArray(saved)) setDeviceList(current => [...current, ...saved.filter(item => item?.ip && !current.some(device => device.ip === item.ip))]);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { host, protocol } = window.location;
      setServerUrl(`${protocol}//${host}`);
    }
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: {signal?: AbortSignal}) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'filter_devices',
      title: 'Filter lighting devices',
      description: 'Filter the visible lighting-network device list by health state and optional search text.',
      inputSchema: { type: 'object', properties: { health: { type: 'string', enum: ['All','Healthy','Warning','Offline'] }, search: { type: 'string' } }, required: ['health'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { health?: string; search?: string };
        if (!['All','Healthy','Warning','Offline'].includes(value.health ?? '')) throw new Error('Invalid health filter');
        setFilter(value.health!);
        setQuery(value.search ?? '');
        return { health: value.health, search: value.search ?? '' };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <main className="min-h-screen bg-[#101519] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#101519]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-7">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-md border border-teal-300/30 bg-teal-300/10 text-teal-300"><Activity size={19}/></div><div><div className="text-[15px] font-bold tracking-wide">LUX<span className="text-teal-300">//</span>LINK</div><div className="text-[11px] tracking-[.18em] text-slate-500">NETWORK ANALYZER</div></div></div>
          <div className="hidden items-center gap-5 text-sm text-slate-400 sm:flex"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"/>Listening on en0</span><span>10.101.0.0/16</span><Button size="sm" variant="outline" className="border-white/10 bg-white/5"><RefreshCw size={14}/> Rescan</Button></div>
        </div>
        <div className="mx-auto flex max-w-[1600px] gap-3 border-b border-white/10 px-4 pb-3 pt-2 text-xs text-slate-400 lg:px-7">
          <span className="text-slate-500">Server:</span>
          <a href={serverUrl} target="_blank" rel="noreferrer" className="font-mono text-teal-300 underline decoration-white/30 hover:decoration-white/70">{serverUrl}</a>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-teal-300"><CircleDot size={13}/> Live overview</p><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Show Network <span className="text-slate-500">/ Main Stage</span></h1><p className="mt-1 text-sm text-slate-500">Last discovery sweep 8 seconds ago</p></div>
            <div className="flex w-full gap-2 md:w-auto"><div className="relative min-w-0 flex-1 md:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, IP, protocol…" className="border-white/10 bg-white/[.04] pl-9"/></div>
              <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddError(''); }}>
                <DialogTrigger render={<Button className="shrink-0 bg-teal-300 text-slate-950 hover:bg-teal-200" />}><Plus size={15}/> Add by IP</DialogTrigger>
                <DialogContent className="border border-white/10 bg-[#171d22] p-0 text-slate-100 sm:max-w-md">
                  <form onSubmit={addDevice}>
                    <DialogHeader className="border-b border-white/10 p-5 pr-12"><DialogTitle className="text-xl font-semibold">Add device by IP</DialogTitle><DialogDescription className="text-slate-400">Keep a device in the viewer even when automatic discovery has not found it yet.</DialogDescription></DialogHeader>
                    <div className="space-y-4 p-5"><div className="space-y-2"><label htmlFor="device-name" className="text-sm font-medium text-slate-300">Device name <span className="font-normal text-slate-600">(optional)</span></label><Input id="device-name" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Balcony Node" className="border-white/10 bg-black/15"/></div><div className="space-y-2"><label htmlFor="device-ip" className="text-sm font-medium text-slate-300">IPv4 address</label><Input id="device-ip" value={newIp} onChange={e=>{setNewIp(e.target.value);setAddError('')}} placeholder="10.101.2.50" inputMode="decimal" autoFocus className="border-white/10 bg-black/15 font-mono" aria-invalid={Boolean(addError)} aria-describedby={addError?'device-ip-error':undefined}/>{addError && <p id="device-ip-error" role="alert" className="text-xs text-rose-300">{addError}</p>}<p className="text-xs leading-5 text-slate-500">The viewer will mark it as awaiting discovery until the network collector sees a response.</p></div></div>
                    <DialogFooter className="border-white/10 bg-black/15"><DialogClose render={<Button type="button" variant="outline" className="border-white/10 bg-white/5" />}>Cancel</DialogClose><Button type="submit" className="bg-teal-300 text-slate-950 hover:bg-teal-200">Add device</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Devices online',`${onlineCount} / ${deviceList.length}`,Server,`${offlineCount} offline`,'text-rose-400'],
              ['Active universes',`${activeUniverseCount}`,Radio,`${activeUniverseCount} currently observed`,'text-teal-300'],
              ['Packet rate','36.8k',Zap,'pkts / sec','text-sky-300'],
              ['Network health',`${networkHealth}%`,ShieldCheck,actionNeededLabel,'text-amber-300'],
            ].map(([label,value,Icon,note,color]) => <div key={label as string} className="rounded-lg border border-white/10 bg-[#181e23] p-4 shadow-[0_12px_30px_rgb(0_0_0/.18)]"><div className="mb-4 flex items-center justify-between text-slate-500"><span className="text-xs font-medium uppercase tracking-wider">{label as string}</span><Icon size={17}/></div><div className={`font-mono text-3xl font-semibold ${color as string}`}>{value as string}</div><div className="mt-1 text-xs text-slate-500">{note as string}</div></div>)}
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#171d22]">
            <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Discovered devices</h2><p className="text-xs text-slate-500">RDMnet, ArtPoll, sACN sources and known stations</p></div><Tabs value={filter} onValueChange={setFilter}><TabsList className="bg-black/20">{['All','Healthy','Warning','Offline'].map(x=><TabsTrigger key={x} value={x} className="text-xs">{x}{x==='All' ? ` ${deviceList.length}` : ''}</TabsTrigger>)}</TabsList></Tabs></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead className="border-b border-white/10 bg-black/10 text-[11px] uppercase tracking-[.12em] text-slate-500"><tr><th className="px-4 py-3 font-medium">Device</th><th className="px-4 py-3 font-medium">Address</th><th className="px-4 py-3 font-medium">Protocol</th><th className="px-4 py-3 font-medium">Universe</th><th className="px-4 py-3 font-medium">Traffic</th><th className="px-4 py-3 font-medium">Health</th><th className="w-10"/></tr></thead>
              <tbody>{visible.map(d=><tr key={d.ip} onClick={()=>setSelected(d)} className={`cursor-pointer border-b border-white/[.06] transition hover:bg-white/[.035] ${selected.ip===d.ip?'bg-teal-300/[.045]':''}`}><td className="px-4 py-3.5"><div className="flex items-center gap-3"><span className={`size-2 rounded-full ${statusStyle[d.state]} ${d.state==='Healthy'?'shadow-[0_0_8px_#34d399]':''}`}/><div><div className="font-medium text-slate-200">{d.name}</div><div className="text-xs text-slate-500">{d.model}</div></div></div></td><td className="px-4 py-3.5 font-mono text-xs text-slate-400">{d.ip}</td><td className="px-4 py-3.5 text-xs text-slate-300">{d.protocol}</td><td className="px-4 py-3.5 font-mono text-xs text-slate-300">{d.universes}</td><td className="px-4 py-3.5"><div className="flex w-24 items-center gap-2"><Progress value={d.traffic} className="h-1.5 bg-black/30"/><span className="font-mono text-[11px] text-slate-500">{d.traffic}%</span></div></td><td className="px-4 py-3.5"><span className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-semibold ${d.state==='Healthy'?'border-emerald-400/20 bg-emerald-400/10 text-emerald-300':d.state==='Warning'?'border-amber-400/20 bg-amber-400/10 text-amber-300':'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>{d.state}</span></td><td><ChevronRight size={15} className="text-slate-600"/></td></tr>)}</tbody></table></div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-[#171d22]"><div className="border-b border-white/10 p-4"><div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">Selected device</p><h2 className="mt-1 text-lg font-semibold">{selected.name}</h2></div><Button size="icon-sm" variant="ghost"><Settings2 size={16}/></Button></div></div><div className="space-y-4 p-4"><div className="grid grid-cols-2 gap-3 text-sm"><Info label="Model" value={selected.model}/><Info label="Vendor" value={selected.vendor}/><Info label="IPv4" value={selected.ip} mono/><Info label="Last seen" value={selected.last}/></div><div className="rounded-md border border-white/10 bg-black/15 p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-400">Observed traffic</span><span className="font-mono text-teal-300">{selected.traffic}%</span></div><Progress value={selected.traffic} className="h-2"/></div><div className={`flex gap-3 rounded-md border p-3 text-sm ${selected.state==='Healthy'?'border-emerald-400/20 bg-emerald-400/[.06]':'border-amber-400/20 bg-amber-400/[.06]'}`}><Gauge size={17} className={selected.state==='Healthy'?'text-emerald-300':'text-amber-300'}/><div><div className="font-medium">{selected.state}</div><div className="mt-0.5 text-xs text-slate-400">{selected.detail}</div></div></div>
            <Dialog>
              <DialogTrigger render={<Button className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200" />}>Open device details <ChevronRight size={15}/></DialogTrigger>
              <DialogContent className="border border-white/10 bg-[#171d22] p-0 text-slate-100 sm:max-w-lg">
                <DialogHeader className="border-b border-white/10 p-5 pr-12"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-teal-300"><span className={`size-2 rounded-full ${statusStyle[selected.state]}`}/>{selected.state}</div><DialogTitle className="text-xl font-semibold">{selected.name}</DialogTitle><DialogDescription className="text-slate-400">{selected.model} · {selected.vendor}</DialogDescription></DialogHeader>
                <div className="space-y-5 p-5"><div className="grid grid-cols-2 gap-x-6 gap-y-4"><Info label="IPv4 address" value={selected.ip} mono/><Info label="Last seen" value={selected.last}/><Info label="Protocols" value={selected.protocol}/><Info label="Universes" value={selected.universes} mono/></div><div className="rounded-md border border-white/10 bg-black/15 p-4"><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-300">Observed traffic</span><span className="font-mono text-teal-300">{selected.traffic}%</span></div><Progress value={selected.traffic} className="h-2"/><p className="mt-3 text-xs leading-5 text-slate-500">Traffic reflects packets observed by the network collector, not the device&apos;s link utilization.</p></div><div className={`rounded-md border p-4 ${selected.state==='Healthy'?'border-emerald-400/20 bg-emerald-400/[.06]':selected.state==='Offline'?'border-rose-400/20 bg-rose-400/[.06]':'border-amber-400/20 bg-amber-400/[.06]'}`}><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current report</div><p className="mt-2 text-sm text-slate-200">{selected.detail}</p></div></div>
                <DialogFooter className="border-white/10 bg-black/15"><DialogClose render={<Button variant="outline" className="border-white/10 bg-white/5" />}>Close</DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
          </div></div>
          <div className="rounded-lg border border-white/10 bg-[#171d22] p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Live signals</h2><p className="text-xs text-slate-500">Source activity · last 30 sec</p></div><Network size={17} className="text-teal-300"/></div><div className="relative h-28 overflow-hidden rounded-md border border-white/[.06] bg-black/20 p-3"><div className="scan-line absolute inset-y-0 w-px bg-teal-300/60 shadow-[0_0_12px_#5eead4]"/><svg className="h-full w-full" viewBox="0 0 300 90" preserveAspectRatio="none" aria-label="Live packet activity"><path d="M0 64 L18 63 L25 31 L34 68 L51 62 L68 61 L76 18 L85 67 L102 63 L128 62 L137 38 L146 65 L168 63 L188 61 L196 24 L206 68 L220 62 L247 61 L256 43 L266 64 L300 62" fill="none" stroke="#5eead4" strokeWidth="2"/><path d="M0 74 L45 73 L54 58 L63 76 L122 73 L131 48 L139 77 L207 73 L216 56 L225 75 L300 73" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity=".8"/></svg></div><div className="mt-3 flex gap-4 text-xs text-slate-500"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-teal-300"/>sACN</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-sky-400"/>Art-Net</span></div></div>
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/[.055] p-4"><div className="flex gap-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300"/><div><div className="font-semibold text-amber-100">{alertCardTitle}</div><p className="mt-1 text-xs leading-5 text-slate-400">{alerts.length ? 'Open an item to jump to its device details.' : 'No active alerts from the current discovery set.'}</p>
            <Dialog>
              <DialogTrigger className="mt-3 text-xs font-semibold text-amber-300 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Review alerts →</DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto border border-white/10 bg-[#171d22] p-0 text-slate-100 sm:max-w-lg">
                <DialogHeader className="border-b border-white/10 p-5 pr-12">
                  <div className="flex items-center gap-2 text-amber-300"><AlertTriangle size={17}/><span className="text-xs font-semibold uppercase tracking-[.14em]">Active alerts</span></div>
                  <DialogTitle className="text-xl font-semibold">{alertCardTitle}</DialogTitle>
                  <DialogDescription className="text-slate-400">Review the issue, then open the affected device in the main panel.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 p-5">
                  {alerts.length ? alerts.map((device) => (
                    <div key={device.ip} className={`rounded-md border p-4 ${device.state === 'Offline' ? 'border-rose-400/20 bg-rose-400/[.06]' : 'border-amber-400/20 bg-amber-400/[.06]'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${statusStyle[device.state]}`}/><div className="min-w-0"><div className="font-semibold text-slate-100">{device.name}</div><div className="mt-0.5 text-xs text-slate-500">{device.model} · {device.ip}</div></div></div>
                        <span className={`rounded-sm border px-2 py-1 text-[11px] font-semibold ${device.state === 'Offline' ? 'border-rose-400/20 text-rose-300' : 'border-amber-400/20 text-amber-300'}`}>{device.state}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{device.detail}</p>
                      <DialogClose render={<Button size="sm" variant="outline" className="mt-4 border-white/10 bg-white/5" onClick={() => setSelected(device)} />}>View device <ChevronRight size={14}/></DialogClose>
                    </div>
                  )) : <div className="rounded-md border border-emerald-400/20 bg-emerald-400/[.06] p-4"><p className="text-sm text-slate-200">All discovered devices are healthy.</p></div>}
                </div>
                <DialogFooter className="border-white/10 bg-black/15"><DialogClose render={<Button variant="outline" className="border-white/10 bg-white/5" />}>Close</DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
          </div></div></div>
          <div className="flex items-center justify-between px-1 text-[11px] text-slate-600"><span className="flex items-center gap-1.5"><Clock3 size={12}/> Uptime 06:18:42</span><span className="flex items-center gap-1.5"><Command size={12}/> Collector v0.9</span></div>
        </aside>
      </div>
    </main>
  );
}

function Info({label,value,mono=false}:{label:string;value:string;mono?:boolean}) { return <div><div className="mb-1 text-[11px] uppercase tracking-wider text-slate-600">{label}</div><div className={`truncate text-xs text-slate-300 ${mono?'font-mono':''}`} title={value}>{value}</div></div> }

function isValidIpv4(value: string) { const parts = value.split('.'); return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255); }
