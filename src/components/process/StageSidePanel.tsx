import { useState } from 'react'
import { Bot, ChevronDown, ChevronLeft, ChevronRight, MapPin, Undo2, X } from 'lucide-react'
import { Terms } from '@/components/Terms'
import { DocRow, whatIfFor } from '@/components/guide/parts'
import { roleKind, stageRoles, sysLabel } from '@/lib/derive'
import type { Guide, GuideStep } from '@/lib/guide'
import { tint, type Process } from '@/lib/types'
import { cn } from '@/lib/utils'

/** The stage you clicked on the 3D map: who's involved, its steps (tap one for the details), systems, and the stages either side. */
export function StageSidePanel({ proc, g, k, roleId, onClose, onStage }: {
  proc: Process; g: Guide; k: number; roleId: string | null; onClose?: () => void; onStage: (k: number) => void
}) {
  const { stage, all } = g.stages[k]
  const [open, setOpen] = useState<string | null>(() => (all.find((x) => x.mine) ?? all[0])?.st.id ?? null)
  const roles = stageRoles(proc, stage)
  const n = proc.stages.length
  return (
    <aside aria-label={`Stage ${k + 1}: ${stage.title}`} className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-white shadow-[0_2px_6px_rgba(15,23,42,.06),0_24px_60px_rgba(30,58,138,.16)] max-lg:h-auto">
      <div className="relative flex flex-col gap-1.5 px-5 pb-4 pt-5" style={{ background: tint(stage.color, 0.13) }}>
        {onClose && <button onClick={onClose} aria-label="Close" className="absolute right-3.5 top-3.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-white/80 hover:bg-white"><X size={16} /></button>}
        <span className="text-xs font-extrabold uppercase tracking-[.06em]" style={{ color: stage.color }}>Stage {k + 1} of {n}</span>
        <h2 className={cn('m-0 text-[22px] font-extrabold leading-tight', onClose && 'pr-10')}>{stage.short || stage.title}</h2>
        <span className="text-[13px] text-on-surface-variant">{stage.title}{stage.place ? <> · <MapPin size={12} className="inline align-[-1px]" /> {stage.place}</> : ''}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-4 pt-4 max-lg:overflow-visible">
        {roles.length > 0 && (
          <div className="flex flex-col gap-2"><span className="lbl">Who's involved</span>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span key={r.id} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', roleId === r.id ? 'border-on-surface bg-on-surface text-white' : 'border-outline-variant bg-white')}>
                  {roleKind(r) === 'agent' ? <Bot size={14} aria-label="AI agent" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />}{r.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="lbl">Steps <span className="font-semibold normal-case tracking-normal">· tap one for the details</span></span>
          {all.length === 0 && <p className="m-0 text-sm text-on-surface-variant">The steps for this stage haven't been added yet — {proc.owner} is completing it.</p>}
          {all.map((x) => <StepItem key={x.st.id} proc={proc} g={g} x={x} open={open === x.st.id} onToggle={() => setOpen((o) => (o === x.st.id ? null : x.st.id))} />)}
        </div>

        {stage.systems.length > 0 && (
          <div className="flex flex-col gap-2"><span className="lbl">Usually done in</span>
            <div className="flex flex-wrap gap-1.5">{stage.systems.map((s) => <span key={s} className="inline-flex h-7 items-center rounded-full bg-surface-low px-3 text-[13px] font-semibold"><Terms text={sysLabel(s)} /></span>)}</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-outline-variant px-4 py-3">
        <button onClick={() => onStage(k - 1)} disabled={k === 0}
          className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-full border border-outline-variant bg-white px-3.5 text-[13px] font-bold disabled:cursor-default disabled:opacity-40"><ChevronLeft size={16} />{k > 0 ? proc.stages[k - 1].short : 'Start'}</button>
        <div className="flex-1" />
        <button onClick={() => onStage(k + 1)} disabled={k === n - 1}
          className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-full border-0 bg-primary px-3.5 text-[13px] font-bold text-white disabled:cursor-default disabled:opacity-40">{k < n - 1 ? proc.stages[k + 1].short : 'The end'}<ChevronRight size={16} /></button>
      </div>
    </aside>
  )
}

function StepItem({ proc, g, x, open, onToggle }: { proc: Process; g: Guide; x: GuideStep; open: boolean; onToggle: () => void }) {
  const what = whatIfFor(proc, x)
  const noOther = x.no && x.no.stageId !== x.st.stageId ? ` (stage ${proc.stages.findIndex((s) => s.id === x.no!.stageId) + 1})` : ''
  return (
    <div className={cn('flex flex-col rounded-2xl transition-colors', open ? 'bg-surface-low' : '', !x.mine && 'opacity-50')}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border-0 bg-transparent px-2.5 py-2.5 text-left hover:bg-surface-low">
        <span className={cn('mt-0.5 flex h-7 w-7 flex-none items-center justify-center text-[12px] font-extrabold', x.isCheck ? 'rotate-45 rounded-[6px] bg-[#FDE68A] text-[#92400E]' : x.onPath ? 'rounded-full text-white' : 'rounded-full border-[1.5px] border-dashed border-tertiary bg-white text-tertiary')}
          style={!x.isCheck && x.onPath ? { background: x.stage.color } : undefined}>
          <span className={cn(x.isCheck && '-rotate-45')}>{x.isCheck ? '?' : x.n ?? '!'}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-[15px] leading-snug"><Terms text={x.st.label} /></b>
          <span className="text-xs text-on-surface-variant">{x.role?.name ?? '—'}{!x.onPath ? ' · only if a check says no' : ''}{x.docs.length ? ` · ${x.docs.length} doc${x.docs.length > 1 ? 's' : ''}` : ''}</span>
        </span>
        <ChevronDown size={16} className={cn('mt-1.5 flex-none text-on-surface-variant transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3.5 pl-[50px] text-sm leading-relaxed">
          {x.st.why && <p className="m-0"><b>Why it matters:</b> {x.st.why}</p>}
          {x.isCheck && (
            <div className="flex flex-col gap-1 rounded-xl bg-white px-3 py-2.5 text-[13px]">
              <span><b className="text-secondary">Yes</b> → {x.yes?.label ?? 'the end — all done'}</span>
              <span><b className="text-tertiary">No</b> → {x.no ? `${x.noBack ? 'back to ' : ''}${x.no.label}${noOther}` : 'ask the process owner'}</span>
            </div>
          )}
          {x.thenBack && <span className="flex items-center gap-1.5 text-[13px] font-semibold text-tertiary"><Undo2 size={13} />Then back to “{x.thenBack.label}”</span>}
          <div className="flex flex-col gap-1.5"><b>How to do it</b>
            {x.st.how?.length
              ? <ol className="m-0 flex list-decimal flex-col gap-1 pl-5">{x.st.how.map((h, i) => <li key={i}><Terms text={h} /></li>)}</ol>
              : <span className="text-on-surface-variant">{proc.owner} hasn't added instructions yet.</span>}
          </div>
          {x.docs.length > 0 && (
            <div className="flex flex-col gap-1.5"><b>You'll need</b>
              {x.docs.map((d) => <DocRow key={d.it.id} d={d} usedIn={g.usedIn(d.it.id, x.st.id)} compact />)}
            </div>
          )}
          {what && <p className="m-0 rounded-xl bg-[#FFF7E6] px-3 py-2 text-[13px] text-[#7A3A00]"><b>When this step is needed:</b> {what}</p>}
          {x.handTo && <span className="text-[13px] font-semibold text-on-surface-variant">Then the {x.handTo.name} takes over.</span>}
        </div>
      )}
    </div>
  )
}
