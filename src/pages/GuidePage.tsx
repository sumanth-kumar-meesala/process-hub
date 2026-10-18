import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { ViewSwitch } from '@/components/process/ViewSwitch'
import TimelineView from '@/pages/guide/TimelineView'
import { useGuide } from '@/lib/guide'
import type { Process } from '@/lib/types'
import { useData } from '@/store/store'

/** The Timeline for one process: every stage and step down the left, the chosen step on the right. */
export default function GuidePage() {
  const { id } = useParams()
  const proc = useData((s) => s.processes.find((p) => p.id === id))
  const hydrated = useData((s) => s.hydrated)
  if (!proc) return (
    <div><AppHeader /><p className="p-10 text-on-surface-variant">{hydrated ? 'That process could not be found.' : 'Loading…'} <Link to="/">Back to processes</Link></p></div>
  )
  return <Guide proc={proc} />
}

function Guide({ proc }: { proc: Process }) {
  const library = useData((s) => s.library)
  const run = useGuide(proc, library)
  const [params, setParams] = useSearchParams()
  // a shared link to one step opens on that step
  // and clicking a stage on the process map opens it at that stage's first step (the reader's own, if they have one there)
  const linked = params.get('step')
  const stageNo = params.get('stage')
  useEffect(() => {
    let id = linked && proc.steps.some((x) => x.id === linked) ? linked : undefined
    if (!id && stageNo !== null) {
      const st = run.g.stages[Number(stageNo)]
      id = (st?.usual.find((x) => x.mine) ?? st?.mine[0] ?? st?.all[0])?.st.id
    }
    if (id) run.select(id)
    if (linked || stageNo !== null) setParams({}, { replace: true })
  }, [linked, stageNo]) // eslint-disable-line react-hooks/exhaustive-deps
  const work = proc.steps.filter((x) => x.kind === 'step' || x.kind === 'decision')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-x-5 gap-y-3 px-3 pb-3 sm:px-6 print:hidden">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <nav aria-label="Breadcrumb" className="flex gap-1.5 text-[13px] font-semibold text-on-surface-variant"><Link to="/" className="no-underline">Processes</Link><span aria-hidden>/</span><span>{proc.area}</span></nav>
          <div className="flex flex-wrap items-center gap-2.5">
            {proc.code && <span className="inline-flex h-7 items-center rounded-[9px] bg-primary px-2.5 text-sm font-extrabold text-white">{proc.code}</span>}
            <h1 className="m-0 text-[clamp(22px,2.6vw,30px)] font-extrabold leading-tight tracking-[-0.02em]">{proc.title}</h1>
          </div>
        </div>
        <ViewSwitch procId={proc.id} current="timeline" />
        <label className="flex h-12 items-center gap-2 rounded-full border border-outline-variant bg-white pl-4 pr-1.5 text-sm font-bold">
          Show steps for
          <select value={run.role ?? ''} onChange={(e) => run.setRole(e.target.value || null)}
            className="h-9 max-w-[220px] rounded-full border-0 bg-surface-low px-3 text-sm font-bold text-on-surface">
            <option value="">Everyone</option>
            {proc.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1">
        {work.length === 0 ? (
          <p className="mx-auto max-w-[760px] p-10 text-on-surface-variant">This process doesn't have any steps yet — {proc.owner} is still completing it.</p>
        ) : (
          <TimelineView proc={proc} run={run} />
        )}
      </div>
    </div>
  )
}
