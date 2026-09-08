'use client';
import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ManualDevice } from '@/lib/manual-devices';
import { portAppearance } from '@/lib/port-appearance';
import { portSignalPresence, type SignalSnapshot } from '@/lib/port-signal-status';

type Port = { index: number; label: string; direction: string; inputAddress: number | null; outputAddress: number | null; inputProtocol: string | null; outputProtocol: string | null; active: boolean | null; rdm: boolean | null; error: string | null; displayUniverse?: number | null; addressNote?: string; frameRate?: number | null; mergeMode?: string; channelFrom?: number | null; channelTo?: number | null; channelOffset?: number | null };
export type NodeInfo = { ip: string; checkedAt: number; responding: boolean; online?: boolean; reachabilitySource?: 'web' | 'tcp' | 'ping' | 'none'; name: string; description: string; source: string; report: string; subnetMask: string | null; firmwareCode: number | null; firmware?: string; uptime?: string; mac: string; proplex: boolean; universeEditing?: 'proplex-web'; ports: Port[]; note: string; error: string; consoleBrand?: string; consoleFamily?: string; consoleServicePort?: number; sessionName?: string | null; showFile?: string | null; sessionStatus?: string | null; metadataStatus?: string };
type UniverseUpdate = { index: number; universe: number };

export function DeviceOnlineBadge({ node, polling }: { node?: NodeInfo; polling: boolean }) {
  const online = node?.online ?? node?.responding;
  const text = polling ? 'Checking device…' : !node ? 'Status pending' : online ? 'Device online' : 'Device offline';
  const style = !node || polling ? 'border-white/15 bg-white/5 text-slate-300' : online ? 'border-emerald-300/35 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/35 bg-rose-300/10 text-rose-200';
  return <output className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${style}`}><span className={`size-2 rounded-full ${!node || polling ? 'bg-slate-400' : online ? 'bg-emerald-300' : 'bg-rose-300'}`}/>{text}</output>;
}

function PortFace({ port, editing, value, onChange }: { port: Port; editing: boolean; value: string; onChange: (value: string) => void }) {
  const address = port.displayUniverse ?? port.outputAddress ?? port.inputAddress;
  const protocol = port.outputProtocol || port.inputProtocol;
  const appearance = portAppearance(port);
  const content = <><div className="flex items-center gap-2 border-b-2 pb-1 font-mono text-sm" style={{ borderColor: appearance.line }}><span>{port.label}</span><span>{port.direction === 'Unknown' ? '—' : port.direction}</span></div>{editing ? <><label htmlFor={`port-universe-${port.index}`} className="sr-only">Port {port.label} output universe</label><Input id={`port-universe-${port.index}`} type="number" min={protocol === 'Art-Net' ? 0 : 1} max={32767} step={1} required value={value} onChange={event => onChange(event.target.value)} onFocus={event => event.currentTarget.select()} className="my-1 h-9 border-teal-300/40 bg-black/30 px-1 text-center font-mono text-xl font-semibold"/></> : <div className="mt-1 text-center font-mono text-3xl font-semibold leading-none" style={{ color: appearance.value }}>{address ?? '—'}</div>}<div className="mt-1 text-center text-sm font-semibold" style={{ color: appearance.text }}>{appearance.noData ? 'NO DATA' : protocol || 'Unknown'}</div><div className="text-center text-xs text-slate-400">RDM {port.rdm === null ? 'unknown' : port.rdm ? 'on' : 'off'}</div></>;
  if (editing) return <div className="rounded-lg border border-teal-300/35 bg-[#0d100f] px-2 py-1 text-white" style={{ boxShadow: appearance.shadow }}>{content}</div>;
  return <Dialog><DialogTrigger className="rounded-lg border border-[#77877f] bg-[#0d100f] px-2 py-1 text-left text-white hover:border-teal-200 focus-visible:outline-2 focus-visible:outline-teal-200" style={{ boxShadow: appearance.shadow }} title={appearance.liveOutput ? 'Matching network data is present' : appearance.noData ? 'No current matching network data' : 'Signal presence cannot be determined'} aria-label={`Port ${port.label}, ${port.direction}, ${address === null ? 'universe unknown' : `universe ${address}`}, ${appearance.noData ? 'no data' : appearance.liveOutput ? 'data present' : 'signal unknown'}`}>{content}</DialogTrigger><DialogContent className="border-white/15 bg-[#171d22] text-slate-100"><DialogHeader><DialogTitle>Port {port.label}</DialogTitle><DialogDescription className="text-slate-400">Configuration from the node, correlated with Lux Link's live network receiver.</DialogDescription></DialogHeader><dl className="grid grid-cols-2 gap-4 text-sm">{[['Direction',port.direction],['Input universe',port.inputAddress ?? 'Not reported'],['Output universe',port.outputAddress ?? 'Not reported'],['Protocol',protocol || 'Not reported'],...(port.frameRate !== undefined ? [['Configured frame rate', port.frameRate === null ? 'Not reported' : `${port.frameRate} Hz`], ['Merge', port.mergeMode || 'Not reported'], ['Channel range', `${port.channelFrom ?? '—'}–${port.channelTo ?? '—'}`]] : []),['RDM',port.rdm === null ? 'Not reported' : port.rdm ? 'On' : 'Off'],['Signal state',port.active === null ? 'Not observable' : port.active ? 'Present' : 'No current network data']].map(([label,item]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1">{item}</dd></div>)}</dl>{port.addressNote && <p className="text-sm text-slate-400">{port.addressNote}</p>}{port.error && <p className="text-amber-200">{port.error}</p>}</DialogContent></Dialog>;
}

function DeviceCard({ device, node, polling, deviceType, signals, onEditUniverses }: { device: ManualDevice; node?: NodeInfo; polling: boolean; deviceType: ManualDevice['deviceType']; signals?: SignalSnapshot | null; onEditUniverses?: (ip: string, updates: UniverseUpdate[]) => Promise<void> }) {
  const ports = (node?.ports || []).map(port => ({ ...port, active: portSignalPresence(port, signals) }));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const editablePorts = ports.filter(port => port.direction === 'OUT' && Number.isInteger(port.displayUniverse ?? port.outputAddress));
  const canEdit = deviceType === 'Node' && node?.universeEditing === 'proplex-web' && node.responding && editablePorts.length > 0 && Boolean(onEditUniverses);
  const en12 = node?.description?.trim().toUpperCase() === 'NETRON EN12' && ports.length === 12;
  const columns = en12 ? 12 : ports.length === 6 ? 3 : ports.length === 8 ? 8 : Math.min(8, Math.ceil(ports.length / 2));
  const portWidth = en12 ? 80 : 100;
  const name = node?.description || node?.name || device.name;

  useEffect(() => {
    if (!editing) setDraft(Object.fromEntries(editablePorts.map(port => [port.index, String(port.displayUniverse ?? port.outputAddress)])));
  }, [node?.checkedAt, editing]);

  function beginEdit() {
    setDraft(Object.fromEntries(editablePorts.map(port => [port.index, String(port.displayUniverse ?? port.outputAddress)])));
    setMessage(''); setEditing(true);
  }
  async function save() {
    const updates: UniverseUpdate[] = [];
    for (const port of editablePorts) {
      const raw = draft[port.index] ?? '', universe = Number(raw);
      const minimum = port.outputProtocol === 'Art-Net' ? 0 : 1;
      if (!/^\d+$/.test(raw) || !Number.isInteger(universe) || universe < minimum || universe > 32767) { setMessage(`Port ${port.label}: enter a universe from ${minimum} to 32767.`); return; }
      if (universe !== (port.displayUniverse ?? port.outputAddress)) updates.push({ index: port.index, universe });
    }
    if (!updates.length) { setEditing(false); setMessage('No universe changes were made.'); return; }
    setSaving(true); setMessage('Saving universe changes to the node…');
    try { await onEditUniverses?.(device.ip, updates); setEditing(false); setMessage(`Updated ${updates.length} output ${updates.length === 1 ? 'port' : 'ports'}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The node did not accept the universe changes.'); }
    finally { setSaving(false); }
  }

  return <section aria-label={name} className="overflow-hidden rounded-xl border border-white/15 bg-[#171d22]">
    <div className="flex flex-wrap items-start justify-between gap-4 p-4"><div><h3 className="text-xl font-semibold">{name}</h3>{device.name !== name && !device.name.startsWith('Device ') && <p className="mt-1 text-sm text-slate-400">{device.name}</p>}<div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm"><span><span className="text-slate-400">IP </span><a href={`http://${device.ip}/`} target="_blank" rel="noreferrer" className="font-mono text-teal-200 underline">{device.ip}</a></span><span><span className="text-slate-400">Subnet mask </span><span className="font-mono">{node?.subnetMask || 'Not reported'}</span></span></div></div><div className="flex flex-col items-end gap-2"><DeviceOnlineBadge node={node} polling={polling}/>{canEdit && !editing && <Button size="sm" variant="outline" onClick={beginEdit} className="border-teal-300/30 text-teal-100"><Pencil size={14}/>Edit ports</Button>}{node && !node.responding && node.online && <span className="text-xs text-slate-400">Ping responding · device data unavailable</span>}</div></div>
    {editing && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-300/20 bg-teal-300/[.045] px-4 py-3"><p className="text-sm text-slate-300">Enter output universes, then press Tab to move through ports in physical order. Changes are sent only when you save.</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => { setEditing(false); setMessage(''); }}>Cancel</Button><Button size="sm" disabled={saving} onClick={() => void save()} className="bg-teal-300 text-slate-950 hover:bg-teal-200">{saving ? 'Saving…' : 'Save changes'}</Button></div></div>}
    {ports.length > 0 && <><div className="border-t border-white/10 px-4 py-2 text-sm text-slate-400">{editing ? `${editablePorts.length} output ports available to edit` : `${ports.length} reported ports · select a port for details`}</div><div className="overflow-x-auto px-4 pb-4"><div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(${portWidth}px, 1fr))`, minWidth: columns * (portWidth + 8) }}>{ports.map(port => <PortFace key={port.index} port={port} editing={editing && port.direction === 'OUT'} value={draft[port.index] ?? ''} onChange={value => setDraft(current => ({ ...current, [port.index]: value }))}/>)}</div></div></>}
    <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm text-slate-400">
      {message && <p role="status" className={message.startsWith('Port ') || message.includes('did not') ? 'text-amber-200' : 'text-teal-200'}>{message}</p>}
      {node?.error && <p role="alert" className="text-amber-200">{node.error}</p>}
      {node?.responding && <>{node.report && node.report !== 'Configuration retrieved' && <p className="font-mono text-slate-200">{node.report}</p>}<p>MAC {node.mac || 'Not reported'} · Firmware {node.firmware || (node.firmwareCode !== null ? `ID ${node.firmwareCode}` : 'Not reported')}{node.uptime ? ` · On time ${node.uptime}` : ''}</p>{node.note && <p>{node.note}</p>}</>}
      {node && <p>Last poll: {new Date(node.checkedAt).toLocaleTimeString()}</p>}
      <a href={`http://${device.ip}/${node?.source === 'NETRON web API' ? 'index.html' : 'device.htm'}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-teal-200 underline">Open device web page <ExternalLink size={14}/></a>
    </div>
  </section>;
}

export function DeviceCards({ devices, query, info, pollingIp, deviceType = 'Node', pollBusy = false, signals, onPoll, onEditUniverses }: { devices: ManualDevice[]; query: string; info: Record<string, NodeInfo>; pollingIp: string; deviceType?: ManualDevice['deviceType']; pollBusy?: boolean; signals?: SignalSnapshot | null; onPoll?: () => Promise<void>; onEditUniverses?: (ip: string, updates: UniverseUpdate[]) => Promise<void> }) {
  const typed = devices.filter(device => device.deviceType === deviceType);
  const visible = typed.filter(device => `${device.name} ${device.ip} ${info[device.ip]?.description || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{deviceType === 'Switch' ? 'Switches' : `${deviceType}s`} <span className="text-slate-400">{typed.length}</span></h2><p className="text-sm text-slate-400">Server-managed polling · shared by every browser</p></div>{onPoll && <Button onClick={() => void onPoll()} disabled={pollBusy || !typed.length} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><RefreshCw size={16} className={pollBusy ? 'animate-spin' : ''}/>{pollBusy ? 'Polling…' : deviceType === 'Switch' ? 'Poll Switches' : 'Poll Nodes'}</Button>}</div>{!visible.length && <p className="rounded-lg border border-white/10 p-8 text-center text-slate-400">{typed.length ? 'No matching devices.' : `Add a ${deviceType.toLowerCase()} by IP to begin monitoring.`}</p>}{visible.map(device => <DeviceCard key={device.ip} device={device} node={info[device.ip]} polling={pollingIp === device.ip} deviceType={deviceType} signals={signals} onEditUniverses={onEditUniverses}/>)}</div>;
}
