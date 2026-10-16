import { ArrowRight, Check, Footprints, PartyPopper, RotateCcw, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Terms } from '@/components/Terms'
import { catOf, stepResources } from '@/lib/resources'
import { tint, type Process } from '@/lib/types'
import { roleKind, sysLabel } from '@/lib/derive'
import { useData } from '@/store/store'
import type { useWalk } from '@/lib/walk'

type W = ReturnType<typeof useWalk>

/** The "Walk it with me" card: one step at a time, with Yes/No for checks. */
export function WalkCard({ proc, w, onClose }: { proc: Process; w: W; onClose: () => void }) {
  const library = useData((s) => s.library)
  const { walk, total, doneCount, wentBack } = w
  const step = proc.steps.find((s) => s.id === walk.current)
  const stageIdx = step ? proc.stages.findIndex((s) => s.id === step.stageId) : proc.stages.length - 1
  const stage = proc.stages[stageIdx]
  const role = proc.roles.find((r) => r.id === step?.roleId)
  const pct = total ? Math.round((doneCount / total) * 100) : 0
  const color = stage?.color ?? '#0F766E'
  const res = step ? stepResources(step, library) : []
  const dec = step?.kind === 'decision'
  const stageSteps = proc.steps.filter((x) => x.stageId === step?.stageId && (x.kind === 'step' || x.kind === 'decision'))
  const last = walk.trail[walk.trail.length - 1]
  const cameBack = last && /^no$/i.test(last.label ?? '') && last.to === walk.current

  return (
    <aside aria-label="Walk it with me" aria-live="polite" className="absolute left-2 top-0 z-[40] flex max-h-full max-sm:static max-sm:w-full max-sm:max-w-none max-sm:max-h-none w-[340px] max-w-[calc(100%-16px)] flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-white shadow-[0_2px_6px_rgba(15,23,42,.06),0_24px_60px_rgba(30,58,138,.22)]">
      <div className="flex flex-col gap-2.5 px-5 pb-4 pt-4" style={{ background: tint(color, 0.14) }}>
        <div className="flex items-center gap-2">
          <Footprints size={18} style={{ color }} aria-hidden />
          <span className="text-xs font-extrabold uppercase tracking-[.06em]" style={{ color }}>Walk it with me</span>
          <div className="flex-1" />
          <button onClick={onClose} aria-label="Stop walking" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-white/75"><X size={15} /></button>
        </div>
        {/* progress: one segment per step, filling as you go */}
        <div className="flex gap-[3px]" aria-label={`${doneCount} of ${total} steps done`}>
          {proc.steps.filter((s) => s.kind === 'step' || s.kind === 'decision').map((s) => {
            const c = proc.stages.find((x) => x.id === s.stageId)?.color ?? color
            const d = walk.done.includes(s.id), cur = s.id === walk.current
            return <span key={s.id} className="h-2 flex-1 rounded-full transition-all duration-500" style={{ background: d ? c : cur ? tint(c, 0.5) : '#fff', boxShadow: cur ? `0 0 0 2px ${c}` : undefined }} />
          })}
        </div>
        <span className="text-[13px] font-semibold text-on-surface-variant">{walk.finished ? 'Every step done' : `${doneCount} of ${total} steps done · Stage ${stageIdx + 1}: ${stage?.short}`} · {pct}%</span>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5 pt-4">
        {walk.finished ? (
          <div className="walk-pop flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D3F2DE]"><PartyPopper size={32} className="text-[#0F766E]" /></span>
            <h3 className="m-0 text-xl font-extrabold">You walked the whole process!</h3>
            <p className="m-0 text-sm text-on-surface-variant">{total} steps across {proc.stages.length} stages{wentBack ? ` — and you went back ${wentBack} time${wentBack > 1 ? 's' : ''} when a check said no, just like real life.` : '.'}</p>
            {proc.outcomes.length > 0 && <div className="flex w-full flex-col gap-1.5 rounded-2xl bg-surface-low p-3 text-left"><span className="lbl">Now it's done when</span>{proc.outcomes.map((o) => <span key={o} className="flex items-start gap-2 text-sm"><Check size={16} className="mt-0.5 flex-none text-secondary" />{o}</span>)}</div>}
            <div className="flex gap-2"><Button onClick={w.start}><RotateCcw size={15} />Walk again</Button><Button variant="outlined" onClick={onClose}>Close</Button></div>
          </div>
        ) : step ? (
          <div key={step.id} className="walk-pop flex flex-col gap-4">
            {cameBack && <div className="flex items-center gap-2 rounded-xl bg-[#FFEDD5] px-3 py-2 text-[13px] font-semibold text-[#9A3412]"><Undo2 size={15} />The check said no, so this step needs doing again.</div>}
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-lg font-extrabold text-white" style={{ background: dec ? '#D97706' : color }}>{dec ? '?' : stageSteps.findIndex((x) => x.id === step.id) + 1}</span>
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-lg font-extrabold leading-snug"><Terms text={step.label} /></h3>
                {role && <span className="text-[13px] font-semibold text-on-surface-variant">{roleKind(role) === 'agent' ? '🤖 Done automatically by ' : 'Done by '}{role.name}</span>}
              </div>
            </div>
            {stage?.systems.length ? <span className="text-[13px] text-on-surface-variant">Usually in <Terms text={stage.systems.map(sysLabel).join(', ')} className="font-semibold text-on-surface" /></span> : null}
            {res.length > 0 && (
              <div className="flex flex-col gap-1.5"><span className="lbl">You'll need</span>
                {res.map((it) => <a key={it.id} href={it.url || '#'} target={it.url ? '_blank' : undefined} rel="noreferrer" onClick={(e) => { if (!it.url) e.preventDefault() }}
                  className="flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 text-sm font-semibold text-on-surface no-underline hover:bg-surface-mid">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: catOf(it.category).color }} /><span className="flex-1">{it.title}</span><span className="text-[11px] text-on-surface-variant">{catOf(it.category).one}</span></a>)}
              </div>
            )}
            {dec ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">What's the answer?</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="bg-[#16A34A]" onClick={() => w.advance('yes')}><Check size={16} />Yes</Button>
                  <Button className="bg-[#EA580C]" onClick={() => w.advance('no')}><Undo2 size={16} />No</Button>
                </div>
                <span className="text-xs text-on-surface-variant">Try “No” to see where the work goes back to.</span>
              </div>
            ) : (
              <Button onClick={() => w.advance()} style={{ background: color }}><Check size={16} />Done — next step<ArrowRight size={15} /></Button>
            )}
            <div className="flex gap-1">
              <Button variant="text" size="sm" disabled={!walk.trail.length} onClick={w.back}><Undo2 size={14} />Back a step</Button>
              <div className="flex-1" />
              <Button variant="text" size="sm" onClick={w.start}><RotateCcw size={14} />Start over</Button>
            </div>
          </div>
        ) : <p className="m-0 text-sm text-on-surface-variant">This process has no steps to walk yet.</p>}
      </div>
    </aside>
  )
}
