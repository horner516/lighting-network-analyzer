'use client';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ManualDevice } from '@/lib/manual-devices';

type Port = { index: number; label: string; direction: string; inputAddress: number | null; outputAddress: number | null; inputProtocol: string | null; outputProtocol: string | null; active: boolean | null; rdm: boolean | null; error: string | null; displayUniverse?: number | null; addressNote?: string; frameRate?: number | null; mergeMode?: string; channelFrom?: number | null; channelTo?: number | null; channelOffset?: number | null };
type NodeInfo = { ip: string; checkedAt: number; responding: boolean; name: string; description: string; source: string; report: string; subnetMask: string | null; firmwareCode: number | null; firmware?: string; uptime?: string; mac: string; proplex: boolean; ports: Port[]; note: string; error: string };

export function DeviceCards({ devices, query }: { devices: ManualDevice[]; query: string }) {
  const [info, setInfo] = useState<Record<string, NodeInfo>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pollingIp, setPollingIp] = useState('');
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const ipKey = devices.map(d => d.ip).join(',');
  useEffect(() => {
    const id = ++generation.current;
    const controller = new AbortController();
    let nextPoll: ReturnType<typeof setTimeout> | undefined;
    const ips = ipKey ? ipKey.split(',') : [];
    async function poll() {
      setBusy(ips.length > 0);
      for (const ip of ips) {
        if (controller.signal.aborted) break;
        setPollingIp(ip);
        const request = new AbortController();
        const abort = () => request.abort();
        controller.signal.addEventListener('abort', abort, { once: true });
        const timeout = setTimeout(abort, 10000);
        try {
          const response = await fetch(`/api/devices/poll?ip=${encodeURIComponent(ip)}`, { cache: 'no-store', signal: request.signal });
          if (!response.ok) throw new Error(response.status === 400 ? 'This address is not a supported LAN host address.' : 'Node polling unavailable. Open the updated local LAN app; the hosted website cannot poll your devices.');
          const result = await response.json() as NodeInfo;
          if (result.ip !== ip || !Array.isArray(result.ports) || typeof result.responding !== 'boolean') throw new Error('The server does not support node polling. Open the updated LAN app.');
          if (id === generation.current && !controller.signal.aborted) {
            setInfo(previous => ({ ...previous, [ip]: result }));
            setErrors(previous => ({ ...previous, [ip]: '' }));
          }
        } catch (error) {
          if (id === generation.current && !controller.signal.aborted) {
            setErrors(previous => ({ ...previous, [ip]: error instanceof Error && error.name !== 'AbortError' ? error.message : 'The node poll timed out. Try again.' }));
            setInfo(previous => { const next = { ...previous }; delete next[ip]; return next; });
          }
        } finally { clearTimeout(timeout); controller.signal.removeEventListener('abort', abort); }
      }
      if (id === generation.current && !controller.signal.aborted) {
        setBusy(false); setPollingIp('');
        if (ips.length) nextPoll = setTimeout(() => setRefresh(n => n + 1), 15000);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(nextPoll); };
  }, [ipKey, refresh]);

  const visible = devices.filter(device => `${device.name} ${device.ip} ${info[device.ip]?.description || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Devices <span className="text-slate-400">{devices.length}</span></h2><p className="text-sm text-slate-400">Live web/API polling · 15s between refresh cycles</p></div><Button onClick={() => setRefresh(n => n + 1)} disabled={busy || !devices.length} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>{busy ? 'Polling nodes…' : 'Poll Nodes'}</Button></div>
    {!visible.length && <p className="rounded-lg border border-white/10 p-8 text-center text-slate-400">{devices.length ? 'No matching devices.' : 'Add a device by IP to fetch its identity and available port information.'}</p>}
    {visible.map(device => {
      const node = info[device.ip];
      const ports = node?.ports || [];
      const en12 = node?.description?.trim().toUpperCase() === 'NETRON EN12' && ports.length === 12;
      const columns = en12 ? 12 : ports.length === 6 ? 3 : ports.length === 8 ? 8 : Math.min(8, Math.ceil(ports.length / 2));
      const portWidth = en12 ? 80 : 100;
      const name = node?.description || node?.name || device.name;
      return <section key={device.ip} aria-label={name} className="overflow-hidden rounded-xl border border-white/15 bg-[#171d22]">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4"><div><h3 className="text-xl font-semibold">{name}</h3>{device.name !== name && !device.name.startsWith('Device ') && <p className="mt-1 text-sm text-slate-400">{device.name}</p>}<div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm"><span><span className="text-slate-400">IP </span><a href={`http://${device.ip}/`} target="_blank" rel="noreferrer" className="font-mono text-teal-200 underline">{device.ip}</a></span><span><span className="text-slate-400">Subnet mask </span><span className="font-mono">{node?.subnetMask || 'Not reported'}</span></span></div></div><span className={`rounded-md border px-3 py-1 text-sm ${node?.responding ? 'border-teal-300/30 text-teal-200' : 'border-white/10 text-slate-400'}`}>{pollingIp === device.ip ? 'Polling…' : node?.responding ? 'Web/API responding' : node ? 'Polling unavailable' : 'Not polled'}</span></div>
        {ports.length > 0 && <><div className="border-t border-white/10 px-4 py-2 text-sm text-slate-400">{ports.length} reported ports · select a port for details</div><div className="overflow-x-auto px-4 pb-4"><div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(${portWidth}px, 1fr))`, minWidth: columns * (portWidth + 8) }}>
          {ports.map(port => {
            const address = port.displayUniverse ?? port.outputAddress ?? port.inputAddress;
            const protocol = port.outputProtocol || port.inputProtocol;
            const color = port.error ? '#ff5b55' : port.active ? '#28ed20' : '#84948b';
            return <Dialog key={port.index}><DialogTrigger className="rounded-lg border border-[#858b88] bg-[#0d0f0e] px-2 py-1 text-left text-white hover:border-teal-200 focus-visible:outline-2 focus-visible:outline-teal-200" aria-label={`Port ${port.label}, ${port.direction}, ${address === null ? 'universe unknown' : `address ${address}`}`}><div className="flex items-center gap-2 border-b-2 pb-1 font-mono text-sm" style={{ borderColor: color }}><span>{port.label}</span><span>{port.direction === 'Unknown' ? '—' : port.direction}</span></div><div className="mt-1 text-center font-mono text-3xl font-semibold leading-none">{address ?? '—'}</div><div className="mt-1 text-center text-sm" style={{ color }}>{protocol || 'Unknown'}</div><div className="text-center text-xs text-slate-400">RDM {port.rdm === null ? 'unknown' : port.rdm ? 'on' : 'off'}</div></DialogTrigger><DialogContent className="border-white/15 bg-[#171d22] text-slate-100"><DialogHeader><DialogTitle>{name} · Port {port.label}</DialogTitle><DialogDescription className="text-slate-400">Reported by the node at the last poll. Port controls here are read-only.</DialogDescription></DialogHeader><dl className="grid grid-cols-2 gap-4 text-sm">{[['Direction',port.direction],['Input address',port.inputAddress ?? 'Not reported'],['Output address',port.outputAddress ?? 'Not reported'],['Protocol',protocol || 'Not reported'],...(port.frameRate !== undefined ? [['Configured frame rate', port.frameRate === null ? 'Not reported' : `${port.frameRate} Hz`], ['Merge', port.mergeMode || 'Not reported'], ['Channel range', `${port.channelFrom ?? '—'}–${port.channelTo ?? '—'}`]] : []),['RDM',port.rdm === null ? 'Not reported' : port.rdm ? 'On' : 'Off'],['Data at last poll',port.active === null ? 'Not reported' : port.active ? 'Present' : 'Not reported active']].map(([label,value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>{port.addressNote && <p className="text-sm text-slate-400">{port.addressNote}</p>}{port.error && <p className="text-amber-200">{port.error}</p>}<p className="text-sm text-slate-400">{node?.note}</p></DialogContent></Dialog>;
          })}
        </div></div></>}
        <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm text-slate-400">
          {(errors[device.ip] || node?.error) && <p role="alert" className="text-amber-200">{errors[device.ip] || node?.error}</p>}
          {node?.responding && <><p className="font-mono text-slate-200">{node.report || 'No status text reported'}</p><p>MAC {node.mac || 'Not reported'} · Firmware {node.firmware || (node.firmwareCode !== null ? `ID ${node.firmwareCode}` : 'Not reported')}{node.uptime ? ` · On time ${node.uptime}` : ''}</p><p>{node.note}</p></>}
          {node && <p>Last poll: {new Date(node.checkedAt).toLocaleTimeString()} · Configuration snapshot; hardware health is not verified.</p>}
          <a href={`http://${device.ip}/${node?.source === 'NETRON web API' ? 'index.html' : 'device.htm'}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-teal-200 underline">Open device web page <ExternalLink size={14}/></a>
        </div>
      </section>;
    })}
  </div>;
}
