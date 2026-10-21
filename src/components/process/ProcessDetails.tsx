import { ArrowRight, Bot, Check, Copy, MapPin, Plug, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Terms } from '@/components/Terms'
import { DocRow, stepUrl, useCopy, whatIfFor } from '@/components/guide/parts'
import { roleKind, stageRoles, sysLabel, sysUnsure } from '@/lib/derive'
import type { GuideRun, GuideStep } from '@/lib/guide'
import { tint, type Process } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A check's answer, short enough for a button (the full text is in its tooltip). */
const short = (t?: string) => (t && t.length > 42 ? `${t.slice(0, 40).trimEnd()}…` : t)

/*
 * The stage and step details, shared by the 3D map's side panel and the Timeline,
 * so both views always show exactly the same information.
 */

/** A stage: which one, where, what happens, who's involved (and what any AI agent uses), and its systems. */
export function StageInfo({ proc, k, roleId, compact = false }: { proc: Process; k: number; roleId: string | null; compact?: boolean }) {
  const stage = proc.stages[k]
  const roles = stageRoles(proc, stage)
  const agents = roles.filter((r) => roleKind(r) === 'agent')
  const text = stage.text && !/^\[.*\]$/.test(stage.text.trim()) ? stage.text : ''
  return (
    <div className={cn('flex flex-col gap-3', compact ? 'px-5 pb-4 pt-5' : 'rounded-[22px] px-5 py-4')} style={{ background: tint(stage.color, 0.11) }}>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-extrabold uppercase tracking-[.06em]" style={{ color: stage.color }}>Stage {k + 1} of {proc.stages.length}{compact ? '' : ` · ${stage.short}`}</span>
        {compact && <h2 className="m-0 text-[22px] font-extrabold leading-tight">{stage.short || stage.title}</h2>}
        <span className="text-[13px] text-on-surface-variant">{stage.title}{stage.place ? <> · <MapPin size={12} className="inline align-[-1px]" aria-hidden /> {stage.place}</> : ''}</span>
      </div>
      {text && <p className="m-0 text-sm leading-relaxed"><Terms text={text} /></p>}
      {roles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs font-bold text-on-surface-variant">Who's involved</span>
          {roles.map((r) => (
            <span key={r.id} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold', roleId === r.id ? 'border-on-surface bg-on-surface text-white' : 'border-white bg-white')}>
              {roleKind(r) === 'agent' ? <Bot size={13} aria-label="AI agent" /> : <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}{r.name}
            </span>
          ))}
        </div>
      )}
      {agents.map((a) => (
        <span key={a.id} className="flex items-start gap-1.5 text-[13px] text-on-surface-variant"><Plug size={13} className="mt-0.5 flex-none" aria-hidden />
          <span><b className="text-on-surface">{a.name}</b> is an AI agent — it works automatically{a.tools?.length ? `, using ${a.tools.join(', ')}` : ''}.</span></span>
      ))}
      {stage.systems.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs font-bold text-on-surface-variant">Usually done in</span>
          {stage.systems.map((s) => (
            <span key={s} className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-[12.5px] font-semibold">
              <Terms text={sysLabel(s)} />
              {sysUnsure(s) && <span title="The owner still needs to confirm this system" className="flex h-4 w-4 items-center justify-center rounded-full bg-[#F59E0B] text-[10px] font-extrabold text-ink">?</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** A step: what it is and who does it, why, the Yes / No paths, how to do it, what you'll need, when it's needed, what comes next — and Back / Done / Yes / No. */
export function StepDetails({ proc, run, gs, compact = false }: { proc: Process; run: GuideRun; gs: GuideStep; compact?: boolean }) {
  const { copied, copy } = useCopy()
  const what = whatIfFor(proc, gs)
  const agent = gs.role && roleKind(gs.role) === 'agent'
  const otherStage = (s?: { stageId: string }) => s && s.stageId !== gs.st.stageId ? ` (stage ${proc.stages.findIndex((x) => x.id === s.stageId) + 1})` : ''
  const isCur = run.cur?.st.id === gs.st.id && !run.finished
  const nextLine = gs.thenBack ? null : gs.handTo ? `Then the ${gs.handTo.name} takes over: “${gs.yes!.label}”.` : gs.yes ? `Next: “${gs.yes.label}”.` : 'This is the last step.'
  const h3 = compact ? 'm-0 text-sm font-extrabold' : 'm-0 text-base font-extrabold'
  return (
    <div className={cn('flex flex-col', compact ? 'gap-4 text-sm' : 'gap-5')}>
      {compact ? (
        // in the side card the step's marker and name are already on its row: just where it sits, who does it, and the link
        <div className="flex items-start gap-2">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-on-surface-variant">
            <b>{gs.isCheck ? `A check in stage ${gs.stageIdx + 1}` : gs.local ? `Step ${gs.local}` : 'Only needed when a check says no'}{gs.n ? ` · ${gs.n} of ${run.total}` : ''}</b>
            <span aria-hidden>·</span>
            {agent ? <><Bot size={13} aria-hidden />Done automatically by</> : 'Done by'} <b className="text-on-surface">{gs.role?.name ?? '—'}</b>
            {agent && gs.role?.tools?.length ? <span>· using {gs.role.tools.join(', ')}</span> : null}
          </span>
          <button onClick={() => copy('step', stepUrl(gs.st.id))} title="Copy a link to this step" aria-label="Copy a link to this step"
            className="inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-full border border-outline-variant bg-white px-3 text-xs font-bold hover:bg-surface-low">
            {copied === 'step' ? <><Check size={13} />Copied</> : <><Copy size={13} />Link</>}
          </button>
        </div>
      ) : (
      <div className="flex items-start gap-3.5">
        <StepMark x={gs} cur size={compact ? 40 : 52} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[13px] font-bold text-on-surface-variant">{gs.isCheck ? `A check in stage ${gs.stageIdx + 1}` : gs.local ? `Step ${gs.local}` : `Stage ${gs.stageIdx + 1} · only needed when a check says no`}{gs.n ? ` · ${gs.n} of ${run.total}${run.role ? ' of your steps' : ''}` : ''}</span>
          <h2 className={cn('m-0 font-extrabold leading-tight tracking-[-0.01em]', compact ? 'text-lg' : 'text-[clamp(24px,2.4vw,32px)]')}><Terms text={gs.st.label} /></h2>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: gs.role?.color }} />
            {agent ? <><Bot size={14} aria-hidden />Done automatically by</> : 'Done by'} <b>{gs.role?.name ?? '—'}</b>
            {agent && gs.role?.tools?.length ? <span className="text-on-surface-variant">· using {gs.role.tools.join(', ')}</span> : null}
          </span>
        </div>
        <button onClick={() => copy('step', stepUrl(gs.st.id))} title="Copy a link to this step" aria-label="Copy a link to this step"
          className="inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-full border border-outline-variant bg-white px-3 text-xs font-bold hover:bg-surface-low">
          {copied === 'step' ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy link</>}
        </button>
      </div>
      )}

      {gs.st.why && <p className={cn('m-0 leading-relaxed text-on-surface-variant', !compact && 'text-[17px]')}><b className="text-on-surface">Why it matters:</b> {gs.st.why}</p>}

      {gs.isCheck && (
        <div className={cn('grid gap-2', !compact && 'sm:grid-cols-2')}>
          <div className="rounded-2xl bg-secondary-container/60 px-4 py-2.5"><b className="text-xs uppercase text-secondary">If {gs.st.answers?.yes ?? 'yes'}</b><p className="m-0 mt-0.5 text-sm">Carry on to “{gs.yes?.label ?? 'the end — all done'}”{otherStage(gs.yes)}</p></div>
          <div className="rounded-2xl bg-tertiary-container px-4 py-2.5"><b className="text-xs uppercase text-tertiary">If {gs.st.answers?.no ?? 'no'}</b><p className="m-0 mt-0.5 text-sm">{gs.no ? `${gs.noBack ? 'Go back to' : 'Go to'} “${gs.no.label}”${otherStage(gs.no)}` : gs.noEnds ? 'That path ends here — carry on with the rest of the process' : 'Ask the process owner'}</p></div>
        </div>
      )}
      {gs.thenBack && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-tertiary"><Undo2 size={13} />Then back to “{gs.thenBack.label}”{otherStage(gs.thenBack)}</span>}

      <div className="flex flex-col gap-2">
        <h3 className={h3}>How to do it</h3>
        {gs.st.how?.length ? (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {gs.st.how.map((h, i) => (
              <li key={i} className={cn('flex items-start gap-3 leading-relaxed', !compact && 'text-[15px]')}>
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-extrabold" style={{ background: tint(gs.stage.color, 0.14), color: gs.stage.color }}>{i + 1}</span>
                <span className="pt-px"><Terms text={h} /></span>
              </li>
            ))}
          </ol>
        ) : <p className="m-0 rounded-2xl bg-surface-low px-4 py-2.5 text-sm text-on-surface-variant">{proc.owner} hasn't added instructions for this step yet.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={h3}>You'll need</h3>
        {gs.docs.length ? gs.docs.map((d) => <DocRow key={d.it.id} d={d} usedIn={run.g.usedIn(d.it.id, gs.st.id)} compact={compact} />)
          : <p className="m-0 text-sm text-on-surface-variant">Nothing is linked to this step.</p>}
      </div>

      {what && <p className="m-0 rounded-2xl bg-[#FFF7E6] px-4 py-2.5 text-sm text-[#7A3A00]"><b>When this step is needed:</b> {what}</p>}
      {nextLine && <p className="m-0 text-[13px] font-semibold text-on-surface-variant">{nextLine}</p>}

      {isCur && (
        <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
          <Button variant="outlined" size={compact ? 'sm' : 'lg'} onClick={run.back} disabled={!run.canBack}>Back</Button>
          <div className="flex-1" />
          {gs.isCheck ? (
            <>
              <Button size={compact ? 'sm' : 'lg'} className="bg-tertiary hover:bg-[#9a3412]" title={gs.st.answers?.no} onClick={() => run.go('no')}>{short(gs.st.answers?.no) ?? 'No'}</Button>
              <Button size={compact ? 'sm' : 'lg'} className="bg-secondary hover:bg-[#166534]" title={gs.st.answers?.yes} onClick={() => run.go('yes')}>{short(gs.st.answers?.yes) ?? 'Yes, carry on'}<ArrowRight size={16} /></Button>
            </>
          ) : <Button size={compact ? 'sm' : 'lg'} onClick={() => run.go()}>Done — next step<ArrowRight size={16} /></Button>}
        </div>
      )}
    </div>
  )
}

/** Shown in both views when the reader has gone through every step. */
export function FinishedCard({ proc, run, compact = false }: { proc: Process; run: GuideRun; compact?: boolean }) {
  return (
    <section className={cn('flex flex-col items-start gap-3 rounded-[28px] bg-white', compact ? 'p-5' : 'p-8')}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#16A34A] text-white"><Check size={24} strokeWidth={3} /></span>
      <h2 className={cn('m-0 font-extrabold', compact ? 'text-lg' : 'text-[26px]')}>{run.roleObj ? `That's all of your part as ${run.roleObj.name}` : 'You went through the whole process'}</h2>
      <p className="m-0 text-sm leading-relaxed text-on-surface-variant">Done when: {proc.outcomes.join(' · ') || '—'}</p>
      <Button size="sm" onClick={run.restart}>Start again</Button>
    </section>
  )
}

/** "x of y done" with a bar — the same in both views. */
export function Progress({ run }: { run: GuideRun }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[13px]">
        <b>{run.roleObj ? `Your part as ${run.roleObj.name}` : 'Progress'}</b>
        <b className="text-primary">{run.finished ? `All ${run.total} done` : `${run.doneCount} of ${run.total} done`}</b>
      </div>
      <div className="h-2 rounded-full bg-surface-mid"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${run.finished ? 100 : run.pct}%` }} /></div>
    </div>
  )
}

/**
 * How a step is marked everywhere (Timeline list, 3D side card, step details), so steps never look like stages:
 * a round marker with its number inside the stage ("2.3"), a yellow diamond "?" for a check, a dashed "!" for a step
 * that only happens when a check says no, and a green tick once done. Stages use square badges instead.
 */
export function StepMark({ x, done = false, cur = false, size = 26, muted = false }: { x: GuideStep; done?: boolean; cur?: boolean; size?: number; muted?: boolean }) {
  // someone else's step (when "Show steps for" picks a person): plain grey instead of the stage colour, but fully readable
  if (muted && !done && !cur) return (
    <span className={cn('relative z-[1] flex flex-none items-center justify-center font-extrabold leading-none text-on-surface-variant', x.isCheck ? 'rotate-45 rounded-[6px] bg-surface-mid' : 'rounded-full bg-surface-mid', !x.onPath && !x.isCheck && 'border-[1.5px] border-dashed border-outline')}
      style={{ width: x.isCheck ? size * 0.8 : size, height: x.isCheck ? size * 0.8 : size, margin: x.isCheck ? size * 0.1 : 0, fontSize: size >= 40 ? 15 : size >= 30 ? 11.5 : 10 }}>
      <span className={cn(x.isCheck && '-rotate-45')}>{x.isCheck ? '?' : x.local ?? '!'}</span>
    </span>
  )
  const fs = size >= 40 ? 15 : size >= 30 ? 11.5 : 10
  return (
    <span className={cn('relative z-[1] flex flex-none items-center justify-center font-extrabold leading-none', x.isCheck ? 'rotate-45 rounded-[6px]' : 'rounded-full', !x.onPath && !done && !x.isCheck && 'border-[1.5px] border-dashed border-tertiary')}
      style={{ width: x.isCheck ? size * 0.8 : size, height: x.isCheck ? size * 0.8 : size, margin: x.isCheck ? size * 0.1 : 0, fontSize: fs,
        background: done ? '#16A34A' : x.isCheck ? '#FDE68A' : !x.onPath ? 'white' : cur ? x.stage.color : tint(x.stage.color, 0.16),
        color: done || (cur && !x.isCheck && x.onPath) ? 'white' : x.isCheck ? '#92400E' : !x.onPath ? 'var(--color-tertiary)' : x.stage.color }}>
      <span className={cn(x.isCheck && '-rotate-45')}>{done ? <Check size={Math.round(size * 0.5)} strokeWidth={3} /> : x.isCheck ? '?' : x.local ?? '!'}</span>
    </span>
  )
}
