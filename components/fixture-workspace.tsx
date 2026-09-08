'use client';

import { FileArchive, ShieldAlert, Sparkles } from 'lucide-react';

export function FixtureWorkspace() {
  return <section aria-label="Fixtures" className="space-y-5">
    <div className="rounded-xl border border-white/10 bg-[#171d22] p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-teal-300/25 bg-teal-300/10 text-teal-300"><FileArchive size={22}/></div>
        <div><h2 className="text-xl font-semibold">Fixture tools are coming to Lux Link</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">MVR import, fixture browsing, test output, and RDM linking are planned for a future version. They are not enabled in this build.</p></div>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-xl border border-amber-300/20 bg-amber-300/[.045] p-5">
        <h3 className="flex items-center gap-2 font-semibold text-amber-100"><ShieldAlert size={18}/>Incomplete MVR check</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">Before fixture controls are enabled, Lux Link will validate the imported MVR and clearly mark it incomplete when fixtures do not have a usable embedded GDTF profile and DMX mode.</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-400">
          <li>List every affected fixture type and fixture ID.</li>
          <li>Explain whether the GDTF file, mode, or patch address is missing.</li>
          <li>Flag overlapping addresses and keep unsafe output disabled.</li>
        </ul>
      </article>
      <article className="rounded-xl border border-white/10 bg-[#171d22] p-5">
        <h3 className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-teal-300"/>Planned fixture view</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">Fixtures will be grouped by type and position, with individual selection, verified sACN or Art-Net tests, and optional linking to fixtures discovered through an RDM-capable node.</p>
      </article>
    </div>
  </section>;
}
