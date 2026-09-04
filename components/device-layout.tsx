'use client';
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, LayoutList, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { moveDevice } from '@/lib/device-layout';
import type { ManualDevice } from '@/lib/manual-devices';

export function DeviceLayout({ devices, onSave }: { devices: ManualDevice[]; onSave: (baseOrder: string[], order: string[]) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [dragging, setDragging] = useState('');
  const [over, setOver] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const dropTarget = useRef('');
  const removed = base.filter(ip => !draft.includes(ip));
  function changeOpen(value: boolean) {
    if (saving) return;
    if (value) { const ips = devices.map(d => d.ip); setBase(ips); setDraft(ips); setError(''); setAnnouncement(''); }
    setDragging(''); setOver(''); dropTarget.current = ''; setOpen(value);
  }
  function move(ip: string, target: string) {
    const next = moveDevice(draft, ip, target);
    setDraft(next); setAnnouncement(`${ip} moved to position ${next.indexOf(ip) + 1}.`);
  }
  async function save() {
    setSaving(true); setError('');
    try { await onSave(base, draft); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the layout.'); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger render={<Button size="sm" variant="outline" className="border-white/10 bg-white/5" />}><LayoutList size={16}/>Layout</DialogTrigger>
    <DialogContent className="border-white/15 bg-[#171d22] text-slate-100 sm:max-w-lg">
      <DialogHeader><DialogTitle>Device layout</DialogTitle><DialogDescription className="text-slate-400">Drag the IP addresses into dashboard order. Changes apply to every browser when saved.</DialogDescription></DialogHeader>
      <p id="layout-help" className="text-sm text-slate-400">Use the grip to drag, or the arrows to move a device.</p>
      <ol ref={list} aria-label="Device display order" className="max-h-[50vh] space-y-2 overflow-y-auto overscroll-contain py-1">
        {draft.map((ip, index) => <li key={ip} data-layout-ip={ip} className={`flex items-center gap-2 rounded-lg border p-2 ${over === ip && dragging !== ip ? 'border-teal-300 bg-teal-300/10' : 'border-white/10 bg-black/15'} ${dragging === ip ? 'opacity-60' : ''}`}>
          <button type="button" disabled={saving} aria-label={`Drag ${ip}`} aria-describedby="layout-help" className="touch-none cursor-grab rounded p-2 text-slate-400 focus-visible:outline-2 focus-visible:outline-teal-300 active:cursor-grabbing disabled:opacity-40"
            onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setDragging(ip); dropTarget.current = ip; }}
            onPointerMove={event => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const bounds = list.current?.getBoundingClientRect();
              if (bounds && list.current) { if (event.clientY < bounds.top + 30) list.current.scrollTop -= 12; else if (event.clientY > bounds.bottom - 30) list.current.scrollTop += 12; }
              const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-layout-ip]');
              const target = row?.getAttribute('data-layout-ip');
              if (target && draft.includes(target)) { dropTarget.current = target; setOver(target); }
            }}
            onPointerUp={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; event.currentTarget.releasePointerCapture(event.pointerId); move(ip, dropTarget.current); setDragging(''); setOver(''); }}
            onPointerCancel={() => { setDragging(''); setOver(''); dropTarget.current = ''; }}
            onKeyDown={event => { const offset = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0; if (offset) { event.preventDefault(); if (draft[index + offset]) move(ip, draft[index + offset]); } }}><GripVertical size={18}/></button>
          <span className="w-5 text-center text-xs text-slate-500">{index + 1}</span><span className="min-w-0 flex-1 break-all font-mono text-sm text-teal-100">{ip}</span>
          <Button type="button" size="icon" variant="ghost" disabled={saving || index === 0} aria-label={`Move ${ip} up`} onClick={() => move(ip, draft[index - 1])}><ArrowUp size={16}/></Button>
          <Button type="button" size="icon" variant="ghost" disabled={saving || index === draft.length - 1} aria-label={`Move ${ip} down`} onClick={() => move(ip, draft[index + 1])}><ArrowDown size={16}/></Button>
          <Button type="button" size="icon" variant="ghost" disabled={saving} className="text-rose-300 hover:bg-rose-400/10" aria-label={`Delete ${ip}`} onClick={() => { setDraft(previous => previous.filter(value => value !== ip)); setAnnouncement(`${ip} marked for deletion. Save to apply.`); }}><Trash2 size={16}/></Button>
        </li>)}
      </ol>
      {!draft.length && <p className="py-4 text-center text-sm text-slate-400">{base.length ? 'All devices are marked for deletion.' : 'No devices added yet.'}</p>}
      {!!removed.length && <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-rose-300">{removed.length} device{removed.length === 1 ? '' : 's'} will be deleted from the server list.</span><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { setDraft(previous => [...previous, ...removed]); setAnnouncement('Deletions undone.'); }}>Undo deletions</Button></div>}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <DialogFooter className="border-white/10 bg-transparent"><Button type="button" variant="outline" disabled={saving} onClick={() => changeOpen(false)}>Cancel</Button><Button type="button" disabled={saving || JSON.stringify(base) === JSON.stringify(draft)} className="bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={save}>{saving ? 'Saving…' : removed.length ? `Save layout · delete ${removed.length}` : 'Save layout'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
