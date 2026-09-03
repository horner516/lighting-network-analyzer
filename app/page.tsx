'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react';
import { SignalMonitor } from '@/components/signal-monitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { manualDevice, normalizeIp, restoreManualDevices, savedDevicesKey, type ManualDevice } from '@/lib/manual-devices';
import { checkLatestRelease, releasePage } from '@/lib/updates';
import { version } from '../package.json';

export default function Home() {
  const [query, setQuery] = useState('');
  const [deviceList, setDeviceList] = useState<ManualDevice[]>([]);
  const [selected, setSelected] = useState<ManualDevice | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [showReleaseLink, setShowReleaseLink] = useState(false);
  const visible = useMemo(() => deviceList.filter(device => `${device.name} ${device.ip}`.toLowerCase().includes(query.toLowerCase())), [deviceList, query]);

  useEffect(() => {
    try { setDeviceList(restoreManualDevices(localStorage.getItem(savedDevicesKey) ?? '[]')); }
    catch { setStorageError('Saved devices could not be loaded in this browser.'); }
  }, []);

  useEffect(() => {
    setServerUrl(window.location.origin);
    const controller = new AbortController();
    const refresh = () => fetch('/api/server-info', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ urls?: unknown }> : null)
      .then(info => {
        if (Array.isArray(info?.urls)) setLanUrls(info.urls.filter((url: unknown) => typeof url === 'string' && /^http:\/\/[\da-fA-F.:\[\]]+:\d+$/.test(url)));
      }).catch(() => {});
    void refresh();
    const interval = setInterval(refresh, 15000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: {signal?: AbortSignal}) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'filter_devices', title: 'Filter lighting devices',
      description: 'Search manually added device entries. These entries have unverified health.',
      inputSchema: { type: 'object', properties: { search: { type: 'string' } }, required: ['search'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const { search } = input as { search?: unknown };
        if (typeof search !== 'string') throw new Error('Search must be text');
        setQuery(search); return { search };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function addDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ip = normalizeIp(newIp);
    if (!ip) { setAddError('Enter a valid IPv4 address.'); return; }
    if (deviceList.some(device => device.ip === ip)) { setAddError('That IP address is already in the device list.'); return; }
    const device = manualDevice(newName, ip);
    const next = [...deviceList, device];
    setDeviceList(next);
    try { localStorage.setItem(savedDevicesKey, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('This device is shown for this session only; browser storage is unavailable.'); }
    setSelected(device); setQuery(''); setNewIp(''); setNewName(''); setAddError(''); setAddOpen(false);
  }

  async function checkForUpdates() {
    setCheckingUpdate(true); setUpdateMessage('Checking GitHub…'); setShowReleaseLink(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const release = await checkLatestRelease(version, controller.signal);
      if (release.newer) {
        setUpdateMessage(`${release.version} is available. If no window opens, use the download link.`);
        setShowReleaseLink(true);
        window.open(releasePage, '_blank', 'noopener,noreferrer');
      } else setUpdateMessage(`You're up to date (v${version}).`);
    } catch (error) {
      setUpdateMessage(error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError' ? error.message : 'Unable to check GitHub. Check your internet connection and try again.');
      setShowReleaseLink(true);
    } finally { clearTimeout(timeout); setCheckingUpdate(false); }
  }


  return <main className="min-h-screen bg-[#101519] text-slate-100">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#101519]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 lg:px-7">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-md border border-teal-300/30 bg-teal-300/10 text-teal-300"><Activity size={19}/></div><div><div className="text-[15px] font-bold tracking-wide">LUX<span className="text-teal-300">//</span>LINK</div><div className="text-xs tracking-widest text-slate-500">NETWORK ANALYZER</div></div></div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-400"><span>v{version}</span><Button onClick={checkForUpdates} disabled={checkingUpdate} size="sm" variant="outline" className="border-white/10 bg-white/5"><RefreshCw size={14} className={checkingUpdate ? 'animate-spin' : ''}/>{checkingUpdate ? 'Checking…' : 'Check for updates'}</Button></div>
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-wrap gap-3 px-4 pb-3 text-sm lg:px-7"><span className="text-slate-500">{lanUrls.length ? 'Server IP / port:' : 'Server address:'}</span>{(lanUrls.length ? lanUrls : [serverUrl]).map(url => <a key={url} href={url || undefined} target="_blank" rel="noreferrer" className="break-all font-mono text-teal-300 underline decoration-white/30">{url || 'Loading…'}</a>)}</div>
      {updateMessage && <div role="status" aria-live="polite" className="mx-auto flex max-w-[1600px] flex-wrap gap-3 px-4 pb-3 text-sm text-slate-300 lg:px-7"><span>{updateMessage}</span>{showReleaseLink && <a href={releasePage} target="_blank" rel="noreferrer" className="text-teal-300 underline">Open GitHub downloads</a>}</div>}
    </header>

    <div className="mx-auto max-w-[1600px] p-4 lg:p-7">
      <Tabs defaultValue="overview">
      <TabsList aria-label="Dashboard views" className="mb-4 bg-[#1b252c] text-slate-100">
        <TabsTrigger value="overview" className="px-4 text-slate-300 data-active:bg-teal-300/15 data-active:text-teal-200">Overview</TabsTrigger>
        <TabsTrigger value="signals" className="px-4 text-slate-300 data-active:bg-teal-300/15 data-active:text-teal-200">Network</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
      {storageError && <p role="alert" className="mb-4 text-sm text-amber-200">{storageError}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Lighting network</h1><p className="mt-1 text-sm text-slate-500">Device inventory</p></div>
            <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><Input aria-label="Search devices" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or IP…" className="border-white/10 bg-white/[.04] pl-9"/></div>
              <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) setAddError(''); }}>
                <DialogTrigger render={<Button className="shrink-0 bg-teal-300 text-slate-950 hover:bg-teal-200" />}><Plus size={15}/> Add by IP</DialogTrigger>
                <DialogContent className="border border-white/10 bg-[#171d22] text-slate-100 sm:max-w-md"><form onSubmit={addDevice}>
                  <DialogHeader><DialogTitle>Add device by IP</DialogTitle><DialogDescription className="text-slate-400">Save a device entry in this browser. Its address and health will not be checked.</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-5"><div className="space-y-2"><label htmlFor="device-name">Device name (optional)</label><Input id="device-name" value={newName} onChange={event => setNewName(event.target.value)} className="border-white/10 bg-black/15"/></div><div className="space-y-2"><label htmlFor="device-ip">IPv4 address</label><Input id="device-ip" value={newIp} onChange={event => { setNewIp(event.target.value); setAddError(''); }} inputMode="decimal" autoFocus className="border-white/10 bg-black/15 font-mono" aria-invalid={Boolean(addError)} aria-describedby={addError ? 'device-ip-error' : undefined}/>{addError && <p id="device-ip-error" role="alert" className="text-sm text-rose-300">{addError}</p>}</div></div>
                  <DialogFooter className="border-white/10 bg-transparent"><DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button type="submit" className="bg-teal-300 text-slate-950 hover:bg-teal-200">Add device</Button></DialogFooter>
                </form></DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#171d22]">
            <div className="border-b border-white/10 p-4"><h2 className="font-semibold">Devices <span className="text-slate-500">{deviceList.length}</span></h2><p className="text-sm text-slate-500">Manually added entries · stored in this browser</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-white/10 text-slate-500"><tr><th className="px-4 py-3 font-medium">Device</th><th className="px-4 py-3 font-medium">IP address</th><th className="px-4 py-3 font-medium">Health</th></tr></thead><tbody>
              {visible.map(device => <tr key={device.ip} className={`border-b border-white/[.06] ${selected?.ip === device.ip ? 'bg-teal-300/[.045]' : ''}`}><td className="px-4 py-4"><button onClick={() => setSelected(device)} className="text-left font-medium text-teal-200 hover:underline">{device.name}</button><div className="text-xs text-slate-500">Manually added</div></td><td className="px-4 py-4 font-mono text-slate-400">{device.ip}</td><td className="px-4 py-4 text-slate-400">Unverified</td></tr>)}
              {!visible.length && <tr><td colSpan={3} className="px-5 py-12 text-center"><p className="font-medium text-slate-200">{deviceList.length ? 'No matching devices' : 'No devices added'}</p><p className="mt-2 text-sm text-slate-500">{deviceList.length ? 'Try another name or IP address.' : 'Use Add by IP to save your devices. Automatic discovery is not connected.'}</p></td></tr>}
            </tbody></table></div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-[#171d22] p-4"><h2 className="font-semibold">Selected device</h2>{selected ? <div className="mt-4 space-y-4"><h3 className="text-lg text-teal-200">{selected.name}</h3><DeviceFacts device={selected}/><Dialog><DialogTrigger render={<Button className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200" />}>Open device details <ChevronRight size={15}/></DialogTrigger><DialogContent className="border border-white/10 bg-[#171d22] text-slate-100"><DialogHeader><DialogTitle>{selected.name}</DialogTitle><DialogDescription className="text-slate-400">Manually added · unverified</DialogDescription></DialogHeader><DeviceFacts device={selected}/><DialogFooter className="border-white/10 bg-transparent"><DialogClose render={<Button variant="outline" />}>Close</DialogClose></DialogFooter></DialogContent></Dialog></div> : <p className="mt-3 text-sm text-slate-500">{deviceList.length ? 'Select a device to view its details.' : 'Add a device to view its details.'}</p>}</div>
          <div className="rounded-lg border border-white/10 bg-[#171d22] p-4"><div className="flex items-center gap-2"><AlertTriangle size={18} className="text-slate-400"/><h2 className="font-semibold">Health alerts unavailable</h2></div><p className="mt-3 text-sm text-slate-500">No health reports have been received. This does not mean the devices are healthy.</p><Dialog><DialogTrigger className="mt-3 text-sm font-semibold text-teal-300 hover:underline">Review alerts →</DialogTrigger><DialogContent className="border border-white/10 bg-[#171d22] text-slate-100"><DialogHeader><DialogTitle>Health alerts unavailable</DialogTitle><DialogDescription className="text-slate-400">A network collector must supply real device measurements before this app can report health alerts.</DialogDescription></DialogHeader><DialogFooter className="border-white/10 bg-transparent"><DialogClose render={<Button variant="outline" />}>Close</DialogClose></DialogFooter></DialogContent></Dialog></div>
        </aside>
      </div>
      </TabsContent>
      <TabsContent value="signals"><SignalMonitor /></TabsContent>
      </Tabs>
    </div>
  </main>;
}

function DeviceFacts({device}:{device:ManualDevice}) {
  return <div className="space-y-3 text-sm"><dl className="grid grid-cols-2 gap-3">{[['IP address',device.ip],['Health','Unverified'],['Model','Unknown'],['Protocol','Unknown'],['Last seen','Never observed'],['Traffic','Not measured']].map(([label,value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-200">{value}</dd></div>)}</dl><p className="rounded-md border border-white/10 bg-black/15 p-3 text-slate-400">Saved manually. No connection, reachability, or health check has been performed.</p></div>;
}
