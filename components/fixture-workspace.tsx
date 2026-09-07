'use client';

import { useEffect, useRef, useState } from 'react';
import { FileArchive, ShieldAlert, Square, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type Fixture = { id: string; fixtureId: string; name: string; universe: number | null; address: number | null; groupId: string; profileStatus: string; profileError: string };
type Group = { id: string; manufacturer: string; model: string; mode: string; count: number; mapped: number; universes: number[]; support: Record<TestName, number> };
type Rig = { filename: string; importedAt: string; fixtures: Fixture[]; warnings: string[]; groups: Group[] };
type TestName = 'output' | 'color' | 'pan' | 'tilt' | 'gobo1' | 'gobo2';
type Output = { available: boolean; enabled: boolean; protocol: string; priority: number; priorityTransport: string; groups: string[]; tests: Record<TestName, boolean>; fixtureCount: number; universes: number[]; frameRate: number };
type State = { available: boolean; rig: Rig | null; output: Output; error?: string };

const testLabels: { key: TestName; title: string; detail: string }[] = [
  { key: 'output', title: 'Output · 100%', detail: 'Full intensity with shutter open when mapped.' },
  { key: 'color', title: 'RGB color sweep', detail: 'Continuous six-second red, green and blue sweep.' },
  { key: 'pan', title: 'Pan circle', detail: 'Three-second circle, then reverses for three seconds.' },
  { key: 'tilt', title: 'Tilt test', detail: 'Tilts up and down over three seconds, repeating.' },
  { key: 'gobo1', title: 'Gobo wheel 1', detail: 'Advances every second and rotates when supported.' },
  { key: 'gobo2', title: 'Gobo wheel 2', detail: 'Advances every second and rotates when supported.' },
];

export function FixtureWorkspace() {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [protocol, setProtocol] = useState('sACN');
  const [priority, setPriority] = useState('100');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function readState(signal?: AbortSignal) {
    const response = await fetch('/api/fixtures', { cache: 'no-store', signal });
    const result = await response.json() as State;
    if (!response.ok || !result.available) throw new Error(result.error || 'Fixture service unavailable.');
    setState(result); setSelected(current => result.output.enabled ? result.output.groups : current.length ? current.filter(id => result.rig?.groups.some(group => group.id === id)) : result.output.groups);
    setProtocol(result.output.protocol); setPriority(String(result.output.priority));
  }

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => void readState(controller.signal).catch(() => setMessage('Open Fixtures from the Lux Link LAN app to import MVR and send fixture tests.')).finally(() => { if (!controller.signal.aborted) timer = setTimeout(refresh, 2000); });
    refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  async function importFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mvr')) { setMessage('Choose a file ending in .mvr.'); return; }
    setBusy(true); setMessage('Importing MVR and reading embedded GDTF profiles…');
    try {
      const response = await fetch('/api/fixtures/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Lux-Link-Filename': encodeURIComponent(file.name) }, body: file });
      const result = await response.json() as State;
      if (!response.ok || !result.rig) throw new Error(result.error || 'The MVR file could not be imported.');
      setState(result); setSelected(result.rig.groups.map(group => group.id)); setProtocol(result.output.protocol); setPriority(String(result.output.priority));
      setMessage(`Imported ${result.rig.fixtures.length} fixtures in ${result.rig.groups.length} fixture types.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The MVR file could not be imported.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  async function updateOutput(tests: Record<TestName, boolean>) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/fixtures/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocol, priority: Number(priority), groups: selected, tests }) });
      const result = await response.json() as State;
      if (!response.ok || !result.output?.available) throw new Error(result.error || 'Fixture output unavailable.');
      setState(result); setProtocol(result.output.protocol); setPriority(String(result.output.priority));
      setMessage(result.output.enabled ? `Testing ${result.output.fixtureCount} mapped fixtures on ${result.output.universes.length} universes.` : 'All fixture tests stopped.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Fixture output unavailable.'); }
    finally { setBusy(false); }
  }

  const rig = state?.rig, output = state?.output;
  const selectedGroups = rig?.groups.filter(group => selected.includes(group.id)) || [];
  const supported = (key: TestName) => selectedGroups.reduce((sum, group) => sum + (group.support[key] || 0), 0);
  const tests = output?.tests || { output: false, color: false, pan: false, tilt: false, gobo1: false, gobo2: false };

  return <section aria-label="Fixtures" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 bg-[#171d22] p-5">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><FileArchive size={20} className="text-teal-300"/>MVR fixtures</h2><p className="mt-1 text-sm text-slate-400">Import the rig patch and embedded GDTF profiles. Fixture data is saved once on this Lux Link server.</p></div>
      <div><input ref={input} type="file" accept=".mvr,application/zip" className="sr-only" onChange={event => void importFile(event.target.files?.[0])}/><Button onClick={() => input.current?.click()} disabled={busy} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><Upload size={16}/>{rig ? 'Replace MVR' : 'Upload MVR'}</Button></div>
    </div>

    {message && <output className="block rounded-md border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-sm text-amber-100">{message}</output>}
    {!rig ? <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-white/15 bg-white/[.02] p-8 text-center"><div><FileArchive className="mx-auto mb-3 text-slate-500" size={32}/><h3 className="font-semibold">No fixture file loaded</h3><p className="mt-2 max-w-xl text-sm text-slate-400">Upload an MVR containing GeneralSceneDescription.xml and embedded GDTF files. Unsupported profiles remain visible but are never sent guessed DMX values.</p></div></div> : <>
      <div className="rounded-lg border border-white/10 bg-[#171d22]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><h3 className="font-semibold">{rig.filename}</h3><p className="mt-1 text-sm text-slate-400">{rig.fixtures.length} fixtures · {rig.groups.length} types · {rig.fixtures.filter(item => item.profileStatus === 'mapped').length} mapped</p></div><Button variant="outline" size="sm" disabled={output?.enabled} onClick={() => setSelected(selected.length === rig.groups.length ? [] : rig.groups.map(group => group.id))}>{selected.length === rig.groups.length ? 'Deselect all' : 'Select all types'}</Button></div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">{rig.groups.map(group => <article key={group.id} className={`rounded-md border p-4 ${selected.includes(group.id) ? 'border-teal-300/35 bg-teal-300/[.06]' : 'border-white/10 bg-black/10'}`}>
          <label htmlFor={`fixture-group-${group.id}`} className="flex cursor-pointer items-start gap-3"><Checkbox id={`fixture-group-${group.id}`} checked={selected.includes(group.id)} disabled={output?.enabled} onCheckedChange={checked => setSelected(current => checked ? [...new Set([...current, group.id])] : current.filter(id => id !== group.id))}/><span className="min-w-0 flex-1"><span className="block font-semibold">{group.manufacturer} · {group.model}</span><span className="mt-1 block text-sm text-slate-400">{group.mode} · {group.count} fixtures · {group.mapped} mapped · {group.universes.length ? `Universes ${group.universes.join(', ')}` : 'Unpatched'}</span></span></label>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">{testLabels.map(test => <span key={test.key} className={`rounded border px-2 py-1 ${group.support[test.key] ? 'border-emerald-400/25 text-emerald-200' : 'border-white/10 text-slate-500'}`}>{test.title}: {group.support[test.key]}/{group.count}</span>)}</div>
          <div className="mt-3 max-h-32 overflow-auto border-t border-white/[.07] pt-2 font-mono text-xs text-slate-400">{rig.fixtures.filter(fixture => fixture.groupId === group.id).map(fixture => <div key={fixture.id} className="flex justify-between gap-3 py-1"><span className="truncate">{fixture.fixtureId ? `${fixture.fixtureId} · ` : ''}{fixture.name}</span><span className={fixture.profileStatus === 'mapped' ? 'text-slate-300' : 'text-amber-200'} title={fixture.profileError}>{fixture.universe && fixture.address ? `${fixture.universe}.${fixture.address}` : 'Unpatched'}</span></div>)}</div>
        </article>)}</div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#171d22]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-4"><div><h3 className="font-semibold">Fixture test output</h3><p className="mt-1 text-sm text-slate-400">{selectedGroups.length} fixture types selected · {output?.enabled ? `${output.fixtureCount} fixtures transmitting` : 'output stopped'}</p></div><Button variant="outline" disabled={busy || !output?.enabled} onClick={() => void updateOutput({ output:false,color:false,pan:false,tilt:false,gobo1:false,gobo2:false })} className="border-rose-400/30 text-rose-200"><Square size={14}/>Stop all tests</Button></div>
        <div className="space-y-5 p-4">
          <div className="flex flex-wrap items-end gap-3"><div className="space-y-2"><span id="fixture-protocol-label" className="block text-sm text-slate-400">Protocol</span><Select value={protocol} disabled={output?.enabled} onValueChange={value => value && setProtocol(value)}><SelectTrigger aria-labelledby="fixture-protocol-label" className="min-w-32 border-white/10"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="sACN">sACN</SelectItem><SelectItem value="Art-Net">Art-Net</SelectItem></SelectContent></Select></div>{protocol === 'sACN' ? <div className="space-y-2"><label htmlFor="fixture-priority" className="text-sm text-slate-400">sACN priority</label><Input id="fixture-priority" type="number" min="0" max="200" required disabled={output?.enabled} value={priority} onChange={event => setPriority(event.target.value)} className="w-32 border-white/10 font-mono"/></div> : <div className="space-y-2"><span className="block text-sm text-slate-400">Priority</span><span className="flex h-8 items-center rounded-lg border border-white/10 px-3 text-sm text-slate-500">Not supported</span></div>}<p className="max-w-xl pb-1 text-sm text-slate-400">{protocol === 'sACN' ? 'Written into every sACN packet. Higher priority wins at compliant receivers.' : 'Standard ArtDmx packets do not contain a network-priority field, so Lux Link cannot set one.'}</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{testLabels.map(test => { const count = supported(test.key); const checked = tests[test.key]; return <label htmlFor={`fixture-test-${test.key}`} key={test.key} className={`flex items-start justify-between gap-4 rounded-md border p-4 ${checked ? 'border-emerald-400/35 bg-emerald-400/[.07]' : 'border-white/10 bg-black/10'}`}><span><span className="block font-medium">{test.title}</span><span className="mt-1 block text-sm text-slate-400">{test.detail}</span><span className={`mt-2 block text-xs ${count ? 'text-teal-300' : 'text-amber-200'}`}>{count} selected fixtures supported</span></span><Switch id={`fixture-test-${test.key}`} checked={checked} disabled={busy || !selected.length || count === 0} onCheckedChange={value => void updateOutput({ ...tests, [test.key]: value })}/></label>; })}</div>
          <div className="flex gap-3 rounded-md border border-rose-400/20 bg-rose-400/[.05] p-4 text-sm text-slate-300"><ShieldAlert className="mt-0.5 shrink-0 text-rose-300" size={18}/><p>Fixture tests transmit real DMX and may illuminate or move equipment. Confirm the selected network connection, clear the performance area, and use a priority appropriate for your system before enabling a test.</p></div>
        </div>
      </div>
      {rig.warnings.length > 0 && <details className="rounded-lg border border-amber-300/15 bg-[#171d22] p-4"><summary className="cursor-pointer text-sm text-amber-100">{rig.warnings.length} import warnings</summary><ul className="mt-3 space-y-1 text-sm text-slate-400">{rig.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    </>}
  </section>;
}
