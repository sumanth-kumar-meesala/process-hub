import { useEffect, useRef, useState } from 'react'
import { Bot, Check, ChevronDown, Flag, Search, Undo2, X } from 'lucide-react'
import { FinishedCard, Progress, StageInfo, StepDetails, StepMark } from '@/components/process/ProcessDetails'
import { roleKind } from '@/lib/derive'
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

  return (
    <div className="mx-auto flex h-full w-full max-w-[1360px] gap-5 px-3 pb-4 sm:px-6 max-[979px]:h-auto max-[979px]:flex-col">
      {/* ---------- the timeline ---------- */}
      <nav ref={listRef} aria-label="All stages and steps" className="flex min-h-0 w-[400px] flex-none flex-col gap-3 overflow-y-auto overscroll-contain rounded-[28px] bg-white p-4 max-[979px]:w-full max-[979px]:overflow-visible">
        <Progress run={run} />
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

        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {g.stages.map(({ stage, k, all, usual, mine }) => {
            const shown = needle ? all.filter(hit) : all
            if (needle && !shown.length) return null
            const isOpen = needle ? true : !!open[k]
            const isCur = !run.finished && cur?.stageIdx === k
            const mineUsual = usual.filter((x) => x.mine)
            const doneHere = mineUsual.filter((x) => run.done.has(x.st.id)).length
            const stageDone = run.finished || (mineUsual.length > 0 && doneHere === mineUsual.length)
            // a stage with none of the chosen person's steps: greyed out (no stage colour) so it reads as "not yours"
            const notMine = !!run.role && !mine.length
            return (
              <li key={stage.id} className="relative flex flex-col">
                <button onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} aria-expanded={isOpen}
                  className={cn('relative flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-2xl border-0 bg-transparent py-2 pl-0.5 pr-2 text-left hover:bg-surface-low', !mine.length && !needle && 'text-on-surface-variant')}>
                  {/* a stage: a square badge and "STAGE n" — steps (round markers, n.1, n.2…) sit indented under it */}
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-base font-extrabold"
                    style={notMine ? { background: 'var(--color-surface-mid)', color: 'var(--color-outline)' } : { background: stageDone && !isCur ? '#16A34A' : stage.color, color: 'white', opacity: isCur || stageDone ? 1 : 0.85 }}>
                    {stageDone && !isCur ? <Check size={18} strokeWidth={3} /> : k + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[.08em]" style={{ color: notMine ? 'var(--color-outline)' : stage.color }}>Stage {k + 1}</span>
                    <b className="text-[15px] leading-snug">{stage.short || stage.title}</b>
                    <span className="text-xs text-on-surface-variant">
                      {needle ? `${shown.length} match${shown.length === 1 ? '' : 'es'}` : !mine.length ? `No steps for ${run.roleObj?.name ?? 'you'}` : `${mine.length} ${run.role ? 'of your steps' : 'steps'}${doneHere ? ` · ${doneHere} done` : ''}${isCur ? ' · you are here' : ''}`}
                    </span>
                  </span>
                  <ChevronDown size={16} className={cn('flex-none text-on-surface-variant transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <ol className="m-0 mb-2 ml-[19px] flex list-none flex-col gap-0.5 border-0 border-l-2 border-solid py-1 pl-3" style={{ borderColor: notMine ? 'var(--color-outline-variant)' : tint(stage.color, 0.45) }}>
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
        {run.finished && <FinishedCard proc={proc} run={run} />}
        {cur && !run.finished && (
          <section className="flex flex-col gap-5 rounded-[28px] bg-white p-5 sm:p-6">
            <StageInfo proc={proc} k={cur.stageIdx} roleId={run.role} />
            <div className="px-1 sm:px-2"><StepDetails proc={proc} run={run} gs={cur} /></div>
          </section>
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
        className={cn('flex w-full cursor-pointer items-start gap-3 rounded-2xl border-0 py-2 pl-2 pr-2 text-left transition-colors', cur ? '' : 'bg-transparent hover:bg-surface-low')}
        style={cur ? { background: tint(x.stage.color, 0.12) } : undefined}>
        <span className="mt-px"><StepMark x={x} done={done} cur={cur} muted={!x.mine} /></span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('text-[14.5px] leading-snug', cur ? 'font-extrabold' : x.mine ? 'font-semibold' : 'font-medium text-on-surface-variant', hit && 'rounded bg-[#FEF3C7] px-0.5')}>{x.st.label}</span>
          <span className="text-xs text-on-surface-variant">{agent && <Bot size={11} className="mr-0.5 inline align-[-1px]" aria-label="AI agent" />}{x.role?.name ?? '—'}{!x.onPath ? ' · only if a check says no' : ''}</span>
          {x.isCheck && x.no && <span className="flex items-center gap-1 text-xs font-semibold text-tertiary">If {x.st.answers?.no ?? 'no'} → {x.noBack ? 'back to ' : ''}{x.no.label}{x.no.stageId !== x.st.stageId ? ' (another stage)' : ''}</span>}
          {x.thenBack && <span className="flex items-center gap-1 text-xs font-semibold text-tertiary"><Undo2 size={12} />Then back to {x.thenBack.label}</span>}
        </span>
      </button>
      {x.handTo && x.mine && (
        <span className="ml-[46px] flex items-center gap-1.5 pb-1.5 text-xs font-bold text-on-surface-variant">
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: x.handTo.color }} />→ {x.handTo.name} takes over
        </span>
      )}
    </li>
  )
}
