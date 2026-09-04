'use client';

import { useEffect, useState } from 'react';
import { Activity, Plus, RefreshCw, Search } from 'lucide-react';
import { DeviceCards, type NodeInfo } from '@/components/device-cards';
import { DeviceLayout } from '@/components/device-layout';
import { SignalMonitor } from '@/components/signal-monitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { normalizeIp, restoreManualDevices, savedDevicesKey, type ManualDevice } from '@/lib/manual-devices';
import { checkLatestRelease, releasePage } from '@/lib/updates';
import { version } from '../package.json';

type InventoryResponse = { shared?: boolean; devices?: ManualDevice[]; info?: Record<string, NodeInfo>; busy?: boolean; pollingIp?: string; error?: string };

export default function Home() {
  const [query, setQuery] = useState('');
  const [deviceList, setDeviceList] = useState<ManualDevice[]>([]);
  const [nodeInfo, setNodeInfo] = useState<Record<string, NodeInfo>>({});
  const [pollBusy, setPollBusy] = useState(false);
  const [pollingIp, setPollingIp] = useState('');
  const [adding, setAdding] = useState(false);
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

  function applyInventory(data: InventoryResponse) {
    if (data.shared !== true || !Array.isArray(data.devices) || !data.info) throw new Error('Open the updated local server to use the shared device list.');
    setDeviceList(data.devices); setNodeInfo(data.info); setPollBusy(Boolean(data.busy)); setPollingIp(data.pollingIp || '');
    setStorageError(data.error || '');
  }

  async function inventoryRequest(path = '/api/devices', body?: unknown, signal?: AbortSignal) {
    const response = await fetch(path, { cache: 'no-store', signal, ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(error.error || 'Shared device inventory unavailable. Open the updated local LAN server.');
    }
    const data = await response.json() as InventoryResponse;
    applyInventory(data);
    return data;
  }

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let migrationChecked = false;
    async function refresh() {
      try {
        await inventoryRequest('/api/devices', undefined, controller.signal);
        if (!migrationChecked) {
          migrationChecked = true;
          // Copy legacy entries once; the server merges by IP and preserves existing names.
          let legacy: ManualDevice[] = [];
          try { if (!localStorage.getItem('lux-link-shared-imported')) legacy = restoreManualDevices(localStorage.getItem(savedDevicesKey) || '[]'); } catch {}
          if (legacy.length) {
            await inventoryRequest('/api/devices', { devices: legacy, legacyImport: true }, controller.signal);
            try { localStorage.setItem('lux-link-shared-imported', '1'); } catch {}
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setStorageError(error instanceof Error ? error.message : 'Server connection unavailable.');
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 2000);
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  async function refreshNodes() {
    try { await inventoryRequest('/api/devices/refresh', {}); }
    catch (error) { setStorageError(error instanceof Error ? error.message : 'Unable to refresh devices.'); }
  }

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

  async function addDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ip = normalizeIp(newIp);
    if (!ip) { setAddError('Enter a valid IPv4 address.'); return; }
    if (deviceList.some(device => device.ip === ip)) { setAddError('That IP address is already in the server device list.'); return; }
    setAdding(true);
    try {
      await inventoryRequest('/api/devices', { name: newName, ip });
      setQuery(''); setNewIp(''); setNewName(''); setAddError(''); setAddOpen(false);
    } catch (error) { setAddError(error instanceof Error ? error.message : 'The device could not be saved on the server.'); }
    finally { setAdding(false); }
  }

  async function checkForUpdates() {
    setCheckingUpdate(true); setUpdateMessage('Checking GitHub…'); setShowReleaseLink(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const release = await checkLatestRelease(controller.signal);
      if (release.newer) {
        setUpdateMessage(`${release.version} is available. If no window opens, use the download link.`);
        setShowReleaseLink(true);
        window.open(releasePage, '_blank', 'noopener,noreferrer');
      } else setUpdateMessage(`You're up to date (v${release.currentVersion}).`);
    } catch (error) {
      setUpdateMessage(error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError' ? error.message : 'Unable to check GitHub. Check your internet connection and try again.');
      setShowReleaseLink(true);
    } finally { clearTimeout(timeout); setCheckingUpdate(false); }
  }


  return <main className="min-h-screen bg-[#101519] text-slate-100">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#101519]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 py-3 lg:px-7">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-md border border-teal-300/30 bg-teal-300/10 text-teal-300"><Activity size={19}/></div><div><div className="text-[15px] font-bold tracking-wide">Lux <span className="text-teal-300">Link</span></div><div className="text-xs tracking-widest text-slate-500">NETWORK ANALYZER</div></div></div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-400"><span>v{version}</span><DeviceLayout devices={deviceList} onSave={async (baseOrder, order) => { await inventoryRequest('/api/devices/layout', { baseOrder, order }); }}/><Button onClick={checkForUpdates} disabled={checkingUpdate} size="sm" variant="outline" className="border-white/10 bg-white/5"><RefreshCw size={14} className={checkingUpdate ? 'animate-spin' : ''}/>{checkingUpdate ? 'Checking…' : 'Check for updates'}</Button></div>
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-wrap gap-3 px-4 pb-3 text-sm lg:px-7"><span className="text-slate-500">{lanUrls.length ? 'Server IP / port:' : 'Server address:'}</span>{(lanUrls.length ? lanUrls : [serverUrl]).map(url => <a key={url} href={url || undefined} target="_blank" rel="noreferrer" className="break-all font-mono text-teal-300 underline decoration-white/30">{url || 'Loading…'}</a>)}</div>
      {updateMessage && <div role="status" aria-live="polite" className="mx-auto flex max-w-[1600px] flex-wrap gap-3 px-4 pb-3 text-sm text-slate-300 lg:px-7"><span>{updateMessage}</span>{showReleaseLink && <a href={releasePage} target="_blank" rel="noreferrer" className="text-teal-300 underline">Open GitHub downloads</a>}</div>}
    </header>

    <div className="mx-auto max-w-[1600px] p-4 lg:p-7">
      <Tabs defaultValue="overview">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <TabsList aria-label="Dashboard views" className="shrink-0 bg-[#1b252c] text-slate-100">
        <TabsTrigger value="overview" className="px-4 text-slate-300 data-active:bg-teal-300/15 data-active:text-teal-200">Overview</TabsTrigger>
        <TabsTrigger value="signals" className="px-4 text-slate-300 data-active:bg-teal-300/15 data-active:text-teal-200">Network</TabsTrigger>
      </TabsList>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto"><div className="relative min-w-[180px] flex-1 md:w-60"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><Input aria-label="Search devices" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or IP…" className="border-white/10 bg-white/[.04] pl-9"/></div>
              <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) setAddError(''); }}>
                <DialogTrigger render={<Button className="shrink-0 bg-teal-300 text-slate-950 hover:bg-teal-200" />}><Plus size={15}/> Add by IP</DialogTrigger>
                <DialogContent className="border border-white/10 bg-[#171d22] text-slate-100 sm:max-w-md"><form onSubmit={addDevice}>
                  <DialogHeader><DialogTitle>Add device by IP</DialogTitle><DialogDescription className="text-slate-400">Save this device on the server so every connected browser can see it. The server polls its web/API interface.</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-5"><div className="space-y-2"><label htmlFor="device-name">Device name (optional)</label><Input id="device-name" value={newName} onChange={event => setNewName(event.target.value)} className="border-white/10 bg-black/15"/></div><div className="space-y-2"><label htmlFor="device-ip">IPv4 address</label><Input id="device-ip" value={newIp} onChange={event => { setNewIp(event.target.value); setAddError(''); }} inputMode="decimal" autoFocus className="border-white/10 bg-black/15 font-mono" aria-invalid={Boolean(addError)} aria-describedby={addError ? 'device-ip-error' : undefined}/>{addError && <p id="device-ip-error" role="alert" className="text-sm text-rose-300">{addError}</p>}</div></div>
                  <DialogFooter className="border-white/10 bg-transparent"><DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button type="submit" disabled={adding} className="bg-teal-300 text-slate-950 hover:bg-teal-200">{adding ? 'Saving…' : 'Add device'}</Button></DialogFooter>
                </form></DialogContent>
              </Dialog>
              <Button onClick={refreshNodes} disabled={pollBusy || !deviceList.length} className="shrink-0 bg-teal-300 text-slate-950 hover:bg-teal-200"><RefreshCw size={16} className={pollBusy ? 'animate-spin' : ''}/>{pollBusy ? 'Polling nodes…' : 'Poll Nodes'}</Button>
            </div>
      </div>
      <TabsContent value="overview">
        {storageError && <p role="alert" className="mb-4 text-sm text-amber-200">{storageError}</p>}
        <DeviceCards devices={deviceList} query={query} info={nodeInfo} pollingIp={pollingIp} />
      </TabsContent>
      <TabsContent value="signals"><SignalMonitor /></TabsContent>
      </Tabs>
    </div>
  </main>;
}
