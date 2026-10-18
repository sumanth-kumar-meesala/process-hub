import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bot, Check, ChevronDown, Copy, Flag, MapPin, Search, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Terms } from '@/components/Terms'
import { DocRow, StepAsk, stepUrl, useCopy, whatIfFor } from '@/components/guide/parts'
import { roleKind, sysLabel } from '@/lib/derive'
import type { GuideStep } from '@/lib/guide'
import { tint } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { GuideRun } from '@/lib/guide'
import type { Process } from '@/lib/types'

export interface GuideViewProps { proc: Process; run: GuideRun }

/** Timeline: every stage and step down the left (open a stage to see its steps), the chosen step on the right. */
export default function TimelineView({ proc, run }: GuideViewProps) {
  const { g, cur } = run
  const [open, setOpen] = useState<Record<number, boolean>>(() => ({ [cur?.stageIdx ?? 0]: true }))
  const [q, setQ] = useState('')
  const { copied, copy } = useCopy()
  const listRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)

  // a new step: open its stage, start the details at the top, keep its row in view
  useEffect(() => {
    if (!cur) return
    setOpen((o) => (o[cur.stageIdx] ? o : { [cur.stageIdx]: true }))
    detailRef.current?.scrollTo({ top: 0 })
    requestAnimationFrame(() => {
      const box = listRef.current, row = document.getElementById(`tl-${cur.st.id}`)
      if (!box || !row) return
      const b = box.getBoundingClientRect(), r = row.getBoundingClientRect()
      if (r.top < b.top + 8 || r.bottom > b.bottom - 8) box.scrollBy({ top: r.top - b.top - b.height / 3, behavior: 'smooth' })
    })
  }, [cur?.st.id, run.finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase()
  const hit = (x: GuideStep) => !!needle && [x.st.label, x.role?.name ?? '', ...x.docs.map((d) => d.it.title), x.stage.short].join(' ').toLowerCase().includes(needle)
  const hits = needle ? g.steps.filter(hit).length : 0
  const allOpen = g.stages.every((s) => open[s.k])
  const what = cur ? whatIfFor(proc, cur) : undefined

  return (
    <div className="mx-auto flex h-full w-full max-w-[1360px] gap-5 px-3 pb-4 sm:px-6 max-[979px]:h-auto max-[979px]:flex-col">
      {/* ---------- the timeline ---------- */}
      <nav ref={listRef} aria-label="All stages and steps" className="flex min-h-0 w-[400px] flex-none flex-col gap-3 overflow-y-auto overscroll-contain rounded-[28px] bg-white p-4 max-[979px]:w-full max-[979px]:overflow-visible">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-[13px]">
            <b>{run.roleObj ? `Your part as ${run.roleObj.name}` : 'Progress'}</b>
            <b className="text-primary">{run.finished ? `All ${run.total} done` : `${run.doneCount} of ${run.total} done`}</b>
          </div>
          <div className="h-2 rounded-full bg-surface-mid"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${run.finished ? 100 : run.pct}%` }} /></div>
        </div>
        <label className="flex h-11 items-center gap-2 rounded-full bg-surface-low px-4 text-on-surface-variant">
          <Search size={16} aria-hidden /><span className="sr-only">Find a step</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a step, person or document" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-on-surface outline-none" />
          {needle && <><b className="whitespace-nowrap text-xs text-primary">{hits} match{hits === 1 ? '' : 'es'}</b>
            <button onClick={() => setQ('')} aria-label="Clear search" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-white"><X size={14} /></button></>}
        </label>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-on-surface-variant"><b className="text-on-surface">Starts when:</b> {proc.triggers[0] ?? '—'}{proc.triggers.length > 1 ? ` +${proc.triggers.length - 1} more` : ''}</span>
          <button onClick={() => setOpen(allOpen ? { [cur?.stageIdx ?? 0]: true } : Object.fromEntries(g.stages.map((s) => [s.k, true])))}
            className="h-8 cursor-pointer rounded-full border border-outline-variant bg-white px-3 text-xs font-bold hover:bg-surface-low">{allOpen ? 'Close all' : 'Open all'}</button>
        </div>

        <ol className="relative m-0 flex list-none flex-col p-0">
          <span aria-hidden className="absolute bottom-5 left-[17px] top-5 w-[2px] rounded bg-outline-variant" />
          {g.stages.map(({ stage, k, all, usual, mine }) => {
            const shown = needle ? all.filter(hit) : all
            if (needle && !shown.length) return null
            const isOpen = needle ? true : !!open[k]
            const isCur = !run.finished && cur?.stageIdx === k
            const mineUsual = usual.filter((x) => x.mine)
            const doneHere = mineUsual.filter((x) => run.done.has(x.st.id)).length
            const stageDone = run.finished || (mineUsual.length > 0 && doneHere === mineUsual.length)
            return (
              <li key={stage.id} className="relative flex flex-col">
                <button onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} aria-expanded={isOpen}
                  className={cn('relative flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-2xl border-0 bg-transparent py-2 pl-0.5 pr-2 text-left hover:bg-surface-low', !mine.length && !needle && 'opacity-55')}>
                  <span className="relative z-[1] flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-extrabold ring-4 ring-white"
                    style={{ background: stageDone && !isCur ? '#16A34A' : isCur ? stage.color : 'white', color: stageDone || isCur ? 'white' : stage.color, boxShadow: `inset 0 0 0 2px ${stageDone && !isCur ? '#16A34A' : stage.color}` }}>
                    {stageDone && !isCur ? <Check size={16} strokeWidth={3} /> : k + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-[15px] leading-snug">{stage.short || stage.title}</b>
                    <span className="text-xs text-on-surface-variant">
                      {needle ? `${shown.length} match${shown.length === 1 ? '' : 'es'}` : !mine.length ? 'Not your part' : `${mine.length} ${run.role ? 'of your steps' : 'steps'}${doneHere ? ` · ${doneHere} done` : ''}${isCur ? ' · you are here' : ''}`}
                    </span>
                  </span>
                  <ChevronDown size={16} className={cn('flex-none text-on-surface-variant transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <ol className="m-0 mb-2 flex list-none flex-col gap-0.5 p-0">
                    {shown.map((x) => <Row key={x.st.id} x={x} cur={!run.finished && cur?.st.id === x.st.id} done={run.done.has(x.st.id)} hit={hit(x)} onPick={() => run.select(x.st.id)} />)}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
        <p className="m-0 flex items-start gap-2.5 px-1 text-xs text-on-surface-variant"><Flag size={14} className="mt-0.5 flex-none" /><span><b className="text-on-surface">Done when:</b> {proc.outcomes.join(' · ') || '—'}</span></p>
      </nav>

      {/* ---------- the chosen step ---------- */}
      <main ref={detailRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain max-[979px]:overflow-visible">
        {run.handoff && !run.finished && <p className="m-0 rounded-[18px] bg-primary-container px-5 py-3 text-sm font-semibold text-on-primary-container">{run.handoff}</p>}
        {run.finished && (
          <section className="flex flex-col items-start gap-3 rounded-[28px] bg-white p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#16A34A] text-white"><Check size={28} strokeWidth={3} /></span>
            <h2 className="m-0 text-[26px] font-extrabold">{run.roleObj ? `That's all of your part as ${run.roleObj.name}` : 'You went through the whole process'}</h2>
            <p className="m-0 max-w-[620px] text-[15px] leading-relaxed text-on-surface-variant">Done when: {proc.outcomes.join(' · ') || '—'}</p>
            <Button onClick={run.restart}>Start again</Button>
          </section>
        )}
        {cur && !run.finished && (
          <>
            <section className="flex flex-col gap-5 rounded-[28px] bg-white p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col rounded-2xl px-4 py-2.5" style={{ background: tint(cur.stage.color, 0.1) }}>
                  <span className="text-xs font-extrabold uppercase tracking-[0.06em]" style={{ color: cur.stage.color }}>Stage {cur.stageIdx + 1} · {cur.stage.short}</span>
                  <span className="text-[13px] text-on-surface-variant">{cur.stage.title}{cur.stage.place ? <> · <MapPin size={12} className="inline align-[-1px]" /> {cur.stage.place}</> : ''}</span>
                </div>
                <div className="flex-1" />
                <Button variant="outlined" size="sm" onClick={() => copy('step', stepUrl(cur.st.id))}>{copied === 'step' ? <><Check size={14} />Link copied</> : <><Copy size={14} />Copy link to this step</>}</Button>
              </div>

              <div className="flex items-start gap-4">
                <span className={cn('flex h-14 w-14 flex-none items-center justify-center text-2xl font-extrabold text-white', cur.isCheck ? 'rounded-2xl' : 'rounded-full')}
                  style={{ background: cur.isCheck ? '#C2410C' : cur.stage.color }}>{cur.isCheck ? '?' : cur.n ?? '!'}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[13px] font-bold text-on-surface-variant">{cur.n ? `${run.role ? 'Your step' : 'Step'} ${cur.n} of ${run.total}` : 'Only needed when a check says no'}{cur.isCheck ? ' · a check' : ''}</span>
                  <h2 className="m-0 text-[clamp(24px,2.4vw,32px)] font-extrabold leading-tight tracking-[-0.01em]"><Terms text={cur.st.label} /></h2>
                  <span className="flex items-center gap-2 text-[15px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: cur.role?.color }} />
                    {cur.role && roleKind(cur.role) === 'agent' ? <><Bot size={15} aria-hidden />Done automatically by</> : 'Done by'} <b>{cur.role?.name ?? '—'}</b>
                  </span>
                </div>
              </div>

              {cur.st.why && <p className="m-0 text-[17px] leading-relaxed text-on-surface-variant"><b className="text-on-surface">Why it matters:</b> {cur.st.why}</p>}

              {cur.isCheck && (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-2xl bg-secondary-container/60 px-4 py-3"><b className="text-xs text-secondary">IF YES</b><p className="m-0 mt-0.5 text-sm">Carry on to “{cur.yes?.label ?? 'the end — all done'}”</p></div>
                  <div className="rounded-2xl bg-tertiary-container px-4 py-3"><b className="text-xs text-tertiary">IF NO</b><p className="m-0 mt-0.5 text-sm">{cur.no ? `${cur.noBack ? 'Go back to' : 'Go to'} “${cur.no.label}”` : 'Ask the process owner'}</p></div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <h3 className="m-0 text-base font-extrabold">How to do it</h3>
                {cur.st.how?.length ? (
                  <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {cur.st.how.map((h, i) => (
                      <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed">
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-extrabold" style={{ background: tint(cur.stage.color, 0.14), color: cur.stage.color }}>{i + 1}</span>
                        <span className="pt-0.5"><Terms text={h} /></span>
                      </li>
                    ))}
                  </ol>
                ) : <p className="m-0 rounded-2xl bg-surface-low px-4 py-3 text-sm text-on-surface-variant">{proc.owner} hasn't added instructions for this step yet.</p>}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="m-0 text-base font-extrabold">You'll need</h3>
                {cur.docs.length ? cur.docs.map((d) => <DocRow key={d.it.id} d={d} usedIn={g.usedIn(d.it.id, cur.st.id)} />)
                  : <p className="m-0 text-sm text-on-surface-variant">Nothing is linked to this step.</p>}
                {cur.stage.systems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[13px] text-on-surface-variant">Usually done in
                    {cur.stage.systems.map((s) => <span key={s} className="inline-flex h-7 items-center rounded-full bg-surface-low px-3 font-semibold text-on-surface">{sysLabel(s)}</span>)}
                  </div>
                )}
              </div>

              {what && <p className="m-0 rounded-2xl bg-[#FFF7E6] px-4 py-3 text-sm text-[#7A3A00]"><b>When this step is needed:</b> {what}</p>}

              <div className="flex flex-wrap items-center gap-2.5 border-t border-outline-variant pt-5">
                <Button variant="outlined" size="lg" onClick={run.back} disabled={!run.canBack}>Back</Button>
                <div className="flex-1" />
                {cur.isCheck ? (
                  <>
                    <Button size="lg" className="bg-tertiary hover:bg-[#9a3412]" onClick={() => run.go('no')}>No</Button>
                    <Button size="lg" className="bg-secondary hover:bg-[#166534]" onClick={() => run.go('yes')}>Yes, carry on<ArrowRight size={17} /></Button>
                  </>
                ) : <Button size="lg" onClick={() => run.go()}>Done — next step<ArrowRight size={17} /></Button>}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-[28px] bg-white p-6">
              <h3 className="m-0 text-base font-extrabold">Ask about this step</h3>
              <StepAsk key={cur.st.id} proc={proc} gs={cur} />
            </section>

            <ComingUp run={run} />
          </>
        )}
      </main>
    </div>
  )
}

function Row({ x, cur, done, hit, onPick }: { x: GuideStep; cur: boolean; done: boolean; hit: boolean; onPick: () => void }) {
  const agent = x.role && roleKind(x.role) === 'agent'
  return (
    <li className="flex flex-col">
      <button id={`tl-${x.st.id}`} onClick={onPick} aria-current={cur ? 'step' : undefined}
        className={cn('flex w-full cursor-pointer items-start gap-3 rounded-2xl border-0 py-2 pl-[7px] pr-2 text-left transition-colors', cur ? '' : 'bg-transparent hover:bg-surface-low', !x.mine && 'opacity-45')}
        style={cur ? { background: tint(x.stage.color, 0.12) } : undefined}>
        <span className={cn('relative z-[1] mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center text-[11px] font-extrabold ring-[3px] ring-white', x.isCheck ? 'rotate-45 rounded-[5px]' : 'rounded-full', !x.onPath && !done && !cur && 'border-[1.5px] border-dashed border-tertiary')}
          style={{ background: done ? '#16A34A' : x.isCheck ? '#FDE68A' : cur ? x.stage.color : x.onPath ? 'var(--color-surface-mid)' : 'white', color: done || (cur && !x.isCheck) ? 'white' : x.isCheck ? '#92400E' : 'var(--color-on-surface)' }}>
          <span className={cn(x.isCheck && '-rotate-45')}>{done ? <Check size={12} strokeWidth={3} /> : x.isCheck ? '?' : x.n ?? '!'}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('text-[14.5px] leading-snug', cur ? 'font-extrabold' : 'font-semibold', hit && 'rounded bg-[#FEF3C7] px-0.5')}>{x.st.label}</span>
          <span className="text-xs text-on-surface-variant">{agent && <Bot size={11} className="mr-0.5 inline align-[-1px]" aria-label="AI agent" />}{x.role?.name ?? '—'}{!x.onPath ? ' · only if a check says no' : ''}</span>
          {x.isCheck && x.no && <span className="flex items-center gap-1 text-xs font-semibold text-tertiary">If no → {x.noBack ? 'back to ' : ''}{x.no.label}{x.no.stageId !== x.st.stageId ? ' (another stage)' : ''}</span>}
          {x.thenBack && <span className="flex items-center gap-1 text-xs font-semibold text-tertiary"><Undo2 size={12} />Then back to {x.thenBack.label}</span>}
        </span>
      </button>
      {x.handTo && x.mine && (
        <span className="ml-10 flex items-center gap-1.5 pb-1.5 text-xs font-bold text-on-surface-variant">
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: x.handTo.color }} />→ {x.handTo.name} takes over
        </span>
      )}
    </li>
  )
}

export function ComingUp({ run }: { run: GuideViewProps['run'] }) {
  const out: GuideStep[] = []
  const seen = new Set<string>()
  let x = run.g.get(run.cur?.yes?.id)
  while (x && out.length < 3 && !seen.has(x.st.id)) { seen.add(x.st.id); if (x.mine) out.push(x); x = run.g.get(x.yes?.id) }
  return (
    <section className="flex flex-col gap-2 rounded-[28px] bg-white p-6">
      <h3 className="m-0 text-base font-extrabold">Coming up</h3>
      {out.length ? out.map((u) => (
        <button key={u.st.id} onClick={() => run.select(u.st.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-outline-variant bg-white px-4 py-3 text-left hover:bg-surface-low">
          <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: u.stage.color }} />
          <span className="flex min-w-0 flex-col"><b className="text-[15px]">{u.st.label}</b><span className="text-xs text-on-surface-variant">Stage {u.stageIdx + 1} · {u.role?.name}</span></span>
        </button>
      )) : <p className="m-0 text-sm text-on-surface-variant">That's the last step.</p>}
    </section>
  )
}
