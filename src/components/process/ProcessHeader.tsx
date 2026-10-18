import { Link } from 'react-router-dom'
import { ViewSwitch } from '@/components/process/ViewSwitch'
import type { GuideRun } from '@/lib/guide'
import type { Process } from '@/lib/types'

/** The top of a process, the same on the 3D map and the Timeline: where it lives, its name, the view switch and "Show steps for". */
export function ProcessHeader({ proc, run, current }: { proc: Process; run: GuideRun; current: '3d' | 'timeline' }) {
  const hasSteps = proc.steps.some((x) => x.kind === 'step' || x.kind === 'decision')
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-x-5 gap-y-3 px-3 pb-3 sm:px-6 print:hidden">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
        <nav aria-label="Breadcrumb" className="flex gap-1.5 text-[13px] font-semibold text-on-surface-variant"><Link to="/" className="no-underline">Processes</Link><span aria-hidden>/</span><span>{proc.area}</span></nav>
        <div className="flex flex-wrap items-center gap-2.5">
          {proc.code && <span className="inline-flex h-7 items-center rounded-[9px] bg-primary px-2.5 text-sm font-extrabold text-white">{proc.code}</span>}
          <h1 className="m-0 text-[clamp(22px,2.6vw,30px)] font-extrabold leading-tight tracking-[-0.02em]">{proc.title}</h1>
        </div>
      </div>
      {hasSteps && (
        <>
          <ViewSwitch procId={proc.id} current={current} />
          <label className="flex h-12 items-center gap-2 rounded-full border border-outline-variant bg-white pl-4 pr-1.5 text-sm font-bold">
            Show steps for
            <select value={run.role ?? ''} onChange={(e) => run.setRole(e.target.value || null)}
              className="h-9 max-w-[220px] rounded-full border-0 bg-surface-low px-3 text-sm font-bold text-on-surface">
              <option value="">Everyone</option>
              {proc.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </>
      )}
    </div>
  )
}
