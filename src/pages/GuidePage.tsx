import { Suspense, useEffect } from 'react'
import { Link, NavLink, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { GUIDE_VIEWS } from '@/pages/guide/views'
import { useGuide } from '@/lib/guide'
import type { Process } from '@/lib/types'
import { useData } from '@/store/store'
import { cn } from '@/lib/utils'

/** The guided pages for one process: a few simple ways to follow it, step by step. */
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
  const { view } = useParams()
  const library = useData((s) => s.library)
  const run = useGuide(proc, library)
  const [params, setParams] = useSearchParams()
  const v = GUIDE_VIEWS.find((x) => x.id === view) ?? GUIDE_VIEWS[0]
  // a shared link to one step opens on that step
  const linked = params.get('step')
  useEffect(() => {
    if (linked && proc.steps.some((x) => x.id === linked)) { run.select(linked); setParams({}, { replace: true }) }
  }, [linked]) // eslint-disable-line react-hooks/exhaustive-deps
  const work = proc.steps.filter((x) => x.kind === 'step' || x.kind === 'decision')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-x-5 gap-y-3 px-3 pb-3 sm:px-6 print:hidden">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <Link to={`/process/${proc.id}`} className="inline-flex items-center gap-1.5 self-start text-[13px] font-bold text-on-surface-variant no-underline hover:text-primary"><ArrowLeft size={14} />Back to the process map</Link>
          <div className="flex flex-wrap items-center gap-2.5">
            {proc.code && <span className="inline-flex h-7 items-center rounded-[9px] bg-primary px-2.5 text-sm font-extrabold text-white">{proc.code}</span>}
            <h1 className="m-0 text-[clamp(22px,2.6vw,30px)] font-extrabold leading-tight tracking-[-0.02em]">{proc.title}</h1>
          </div>
        </div>
        {GUIDE_VIEWS.length > 1 && (
          <nav aria-label="Ways to view this process" className="flex flex-wrap gap-1 rounded-full border border-outline-variant bg-white p-1">
            {GUIDE_VIEWS.map((x) => (
              <NavLink key={x.id} to={`/process/${proc.id}/guide/${x.id}`} title={x.blurb}
                className={() => cn('inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold no-underline', x.id === v.id ? 'bg-on-surface text-white' : 'text-on-surface-variant hover:bg-surface-low')}>
                <x.icon size={16} aria-hidden />{x.label}
              </NavLink>
            ))}
          </nav>
        )}
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
          <Suspense fallback={<div className="p-10 text-on-surface-variant">Loading…</div>}>
            <v.View proc={proc} run={run} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
