import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Terms } from '@/components/Terms'
import { FinishedCard, Progress, StageInfo, StepDetails } from '@/components/process/ProcessDetails'
import type { GuideRun, GuideStep } from '@/lib/guide'
import type { Process } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The stage chosen on the 3D map. It shows the same stage and step details as the Timeline
 * (shared components), and the open step is the same "where you are" as in the Timeline.
 */
export function StageSidePanel({ proc, run, k, onStage }: { proc: Process; run: GuideRun; k: number; onStage: (k: number) => void }) {
  const { all } = run.g.stages[k]
  const n = proc.stages.length
  return (
    <aside aria-label={`Stage ${k + 1}: ${proc.stages[k].title}`} className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-white shadow-[0_2px_6px_rgba(15,23,42,.06),0_24px_60px_rgba(30,58,138,.16)] max-lg:h-auto">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain max-lg:overflow-visible">
        <StageInfo proc={proc} k={k} roleId={run.role} compact />
        <div className="flex flex-col gap-3 px-4 pb-4 pt-4">
          <Progress run={run} />
          {run.handoff && !run.finished && <p className="m-0 rounded-2xl bg-primary-container px-4 py-2.5 text-[13px] font-semibold text-on-primary-container">{run.handoff}</p>}
          {run.finished && <FinishedCard proc={proc} run={run} compact />}
          <span className="lbl px-1">Steps <span className="font-semibold normal-case tracking-normal">· tap one for the details</span></span>
          {all.length === 0 && <p className="m-0 px-1 text-sm text-on-surface-variant">The steps for this stage haven't been added yet — {proc.owner} is completing it.</p>}
          <div className="flex flex-col gap-1">
            {all.map((x) => {
              const open = !run.finished && run.cur?.st.id === x.st.id
              return (
                <div key={x.st.id} className={cn('flex flex-col rounded-2xl transition-colors', open ? 'bg-surface-low' : '', !x.mine && !open && 'opacity-50')}>
                  <Row x={x} open={open} done={run.done.has(x.st.id)} onClick={() => run.select(x.st.id)} />
                  {open && <div className="px-3 pb-4 pt-1"><StepDetails proc={proc} run={run} gs={x} compact /></div>}
                </div>
              )
            })}
          </div>
        </div>
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

/** A step in the list: the same marks as the Timeline (number, "?" for a check, ✓ when done, dashed for "only if no"). */
function Row({ x, open, done, onClick }: { x: GuideStep; open: boolean; done: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-expanded={open} className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border-0 bg-transparent px-2.5 py-2.5 text-left hover:bg-surface-low">
      <span className={cn('mt-0.5 flex h-7 w-7 flex-none items-center justify-center text-[12px] font-extrabold', x.isCheck ? 'rotate-45 rounded-[6px]' : 'rounded-full',
        done ? 'bg-[#16A34A] text-white' : x.isCheck ? 'bg-[#FDE68A] text-[#92400E]' : x.onPath ? 'text-white' : 'border-[1.5px] border-dashed border-tertiary bg-white text-tertiary')}
        style={!done && !x.isCheck && x.onPath ? { background: x.stage.color } : undefined}>
        <span className={cn(x.isCheck && '-rotate-45')}>{done ? '✓' : x.isCheck ? '?' : x.n ?? '!'}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[15px] leading-snug"><Terms text={x.st.label} /></b>
        <span className="text-xs text-on-surface-variant">{x.role?.name ?? '—'}{!x.onPath ? ' · only if a check says no' : ''}{x.docs.length ? ` · ${x.docs.length} doc${x.docs.length > 1 ? 's' : ''}` : ''}</span>
      </span>
      <ChevronDown size={16} className={cn('mt-1.5 flex-none text-on-surface-variant transition-transform', open && 'rotate-180')} />
    </button>
  )
}
