'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Radar, RefreshCw, Search, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { ManualDevice } from '@/lib/manual-devices';

type Adapter = { name:string; address:string; netmask?:string };
type DiscoveryResult = { ip:string; name:string; brand:string; model:string; deviceType:'Console'|'Node'|'Switch'; evidence:string[]; confidence:string; alreadyAdded:boolean };
type NetworkResponse = { interfaces?:Adapter[]; selected?:string };
type DiscoveryResponse = { results?:DiscoveryResult[]; error?:string };

export function DeviceDiscovery({ onAdd }: { onAdd:(devices:ManualDevice[])=>Promise<void> }) {
  const [open,setOpen] = useState(false), [scanning,setScanning] = useState(false), [saving,setSaving] = useState(false);
  const [adapters,setAdapters] = useState<Adapter[]>([]), [address,setAddress] = useState(''), [deep,setDeep] = useState(false);
  const [results,setResults] = useState<DiscoveryResult[]>([]), [selected,setSelected] = useState<Set<string>>(new Set()), [error,setError] = useState('');
  useEffect(() => { if (!open) return; fetch('/api/network-interface',{cache:'no-store'}).then(response=>response.json() as Promise<NetworkResponse>).then(data=>{
    const list = Array.isArray(data.interfaces) ? data.interfaces : []; setAdapters(list); setAddress(data.selected || list[0]?.address || '');
  }).catch(()=>setError('Network connections could not be loaded.')); },[open]);
  const selectable = useMemo(()=>results.filter(item=>!item.alreadyAdded),[results]);
  async function scan() {
    setScanning(true); setError('');
    try {
      const response = await fetch('/api/discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,deep})});
      const data = await response.json() as DiscoveryResponse; if (!response.ok) throw new Error(data.error || 'Discovery failed.');
      setResults(data.results || []); setSelected(new Set((data.results || []).filter((item:DiscoveryResult)=>!item.alreadyAdded).map((item:DiscoveryResult)=>item.ip)));
    } catch (value) { setError(value instanceof Error ? value.message : 'Discovery failed.'); }
    finally { setScanning(false); }
  }
  async function addSelected() {
    const additions = results.filter(item=>selected.has(item.ip) && !item.alreadyAdded).map(item=>({ip:item.ip,name:item.name || `Device ${item.ip}`,deviceType:item.deviceType,source:'manual',state:'Unverified'} as ManualDevice));
    if (!additions.length) return; setSaving(true); setError('');
    try { await onAdd(additions); setResults(items=>items.map(item=>selected.has(item.ip)?{...item,alreadyAdded:true}:item)); setSelected(new Set()); }
    catch (value) { setError(value instanceof Error ? value.message : 'Selected devices could not be added.'); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant="outline" className="shrink-0 border-teal-300/30 bg-teal-300/5 text-teal-200 hover:bg-teal-300/10"/>}><Radar size={16}/> Discover Devices</DialogTrigger>
    <DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#151c21] text-slate-100 sm:max-w-4xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl"><Radar className="text-teal-300"/>Discover lighting devices</DialogTitle><DialogDescription className="text-slate-400">Read-only discovery for ProPlex and Art-Net nodes, MA Lighting consoles, and ETC Eos consoles. Review the results before adding them.</DialogDescription></DialogHeader>
      <div className="grid gap-4 rounded-lg border border-white/10 bg-black/15 p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div className="space-y-2"><span className="text-sm text-slate-300">Network connection</span><Select value={address} onValueChange={value=>value&&setAddress(value)}><SelectTrigger aria-label="Network connection" className="w-full border-white/10 bg-white/[.03]"><SelectValue placeholder="Select an adapter"/></SelectTrigger><SelectContent>{adapters.map(item=><SelectItem key={item.address} value={item.address}>{item.name} · {item.address}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex h-9 items-center gap-3 rounded-md border border-white/10 px-3 text-sm"><Switch aria-label="Enable deep scan" checked={deep} onCheckedChange={setDeep}/><span><span className="block text-slate-200">Deep scan</span><span className="text-[11px] text-slate-500">Selected /24 only</span></span></div>
        <Button onClick={scan} disabled={scanning||!address} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><RefreshCw size={16} className={scanning?'animate-spin':''}/>{scanning?'Scanning…':'Scan Again'}</Button>
      </div>
      {!results.length && !scanning && <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-white/10 text-center text-slate-400"><div><Search className="mx-auto mb-3 text-teal-300"/><p className="font-medium text-slate-200">Ready to scan this lighting network</p><p className="mt-1 text-sm">Standard scan uses Art-Net and currently observed traffic. Deep scan can find silent supported devices.</p></div></div>}
      {scanning && <output className="grid min-h-48 place-items-center text-center text-slate-300"><div><Radar className="mx-auto mb-3 animate-pulse text-teal-300" size={34}/><p className="font-medium">Listening for discovery replies…</p><p className="mt-1 text-sm text-slate-500">Deep scans may take about 20 seconds.</p></div></output>}
      {!scanning && results.length>0 && <div className="space-y-2"><div className="flex items-center justify-between text-sm text-slate-400"><span>{results.length} supported device{results.length===1?'':'s'} found</span><button type="button" className="text-teal-300" onClick={()=>setSelected(new Set(selectable.map(item=>item.ip)))}>Select all new</button></div>{results.map(item=><div key={item.ip} className={`flex items-start gap-3 rounded-lg border p-4 ${item.alreadyAdded?'border-white/5 bg-white/[.02] opacity-65':'border-white/10 bg-black/15 hover:border-teal-300/30'}`}><Checkbox aria-label={`Select ${item.name}`} checked={item.alreadyAdded||selected.has(item.ip)} disabled={item.alreadyAdded} onCheckedChange={checked=>setSelected(previous=>{const next=new Set(previous); if(checked) next.add(item.ip); else next.delete(item.ip); return next;})} className="mt-1"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.name}</span><span className="rounded bg-teal-300/10 px-2 py-0.5 text-xs text-teal-200">{item.deviceType}</span>{item.alreadyAdded&&<span className="flex items-center gap-1 text-xs text-emerald-300"><Check size={12}/>Already added</span>}</div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400"><span className="font-mono text-teal-300">{item.ip}</span><span>{item.brand}{item.model&&item.model!==item.name?` · ${item.model}`:''}</span></div><div className="mt-2 flex flex-wrap gap-2">{item.evidence.map(value=><span key={value} className="flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-[11px] text-slate-400"><Wifi size={11}/>{value}</span>)}</div></div></div>)}</div>}
      {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
      <DialogFooter className="border-white/10 bg-transparent"><DialogClose render={<Button type="button" variant="outline"/>}>Close</DialogClose><Button onClick={addSelected} disabled={saving||selected.size===0} className="bg-teal-300 text-slate-950 hover:bg-teal-200">{saving?'Adding…':`Add Selected${selected.size?` (${selected.size})`:''}`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
