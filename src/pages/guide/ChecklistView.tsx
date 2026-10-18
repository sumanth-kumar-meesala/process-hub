import { useState } from 'react'
import { Check, ChevronDown, FileText } from 'lucide-react'
import { ResourceLink } from '@/components/process/ResourceLink'
import { cn } from '@/lib/utils'
import type { GuideViewProps } from './views'

/** Checklist: one plain list of the usual steps, grouped by stage. Tick each one off; tap a step to see how. */
export default function ChecklistView({ proc, run }: GuideViewProps) {
  const { g } = run
  const [open, setOpen] = useState<string | null>(null)
  const rows = g.stages.map((s) => ({ ...s, items: s.usual.filter((x) => x.mine) })).filter((s) => s.items.length)
  const ticked = rows.flatMap((s) => s.items).filter((x) => run.done.has(x.st.id)).length
  const total = rows.reduce((a, s) => a + s.items.length, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7 px-4 pb-16 pt-2">
        <header className="flex flex-col gap-3 rounded-[28px] bg-white p-6">
          <p className="m-0 text-[17px] leading-relaxed text-on-surface-variant">{proc.summary}</p>
          <p className="m-0 text-[17px] leading-relaxed">Tick each step when it's done. Tap a step to see how to do it.</p>
          <div className="flex items-center justify-between text-[17px]"><b>{ticked} of {total} ticked</b>
            {ticked > 0 && <button onClick={() => rows.flatMap((s) => s.items).forEach((x) => run.done.has(x.st.id) && run.toggleDone(x.st.id))} className="cursor-pointer border-0 bg-transparent p-0 text-[15px] font-bold text-primary underline">Clear ticks</button>}
          </div>
          <div className="h-2.5 rounded-full bg-surface-mid"><div className="h-full rounded-full bg-[#16A34A] transition-[width] duration-500" style={{ width: `${(ticked / Math.max(1, total)) * 100}%` }} /></div>
        </header>

        {rows.map((s) => (
          <section key={s.stage.id} className="flex flex-col gap-2.5">
            <h2 className="m-0 px-1 text-[22px] font-extrabold">{s.k + 1}. {s.stage.short || s.stage.title}</h2>
            {s.items.map((x) => {
              const isDone = run.done.has(x.st.id)
              const isOpen = open === x.st.id
              const ifNo = x.isCheck && x.no && !g.get(x.no.id)?.onPath ? x.no : undefined
              return (
                <div key={x.st.id} className={cn('flex flex-col rounded-2xl border-2 bg-white', isOpen ? 'border-primary' : 'border-transparent')}>
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <button onClick={() => run.toggleDone(x.st.id)} aria-pressed={isDone} aria-label={isDone ? `Untick ${x.st.label}` : `Tick ${x.st.label} as done`}
                      className={cn('flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-lg border-2', isDone ? 'border-[#16A34A] bg-[#16A34A] text-white' : 'border-outline bg-white text-transparent hover:text-outline-variant')}>
                      <Check size={20} strokeWidth={3.5} />
                    </button>
                    <button onClick={() => setOpen(isOpen ? null : x.st.id)} aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={cn('text-[18px] font-bold leading-snug', isDone && 'text-on-surface-variant line-through')}>{x.isCheck ? `Check: ${x.st.label}` : x.st.label}</span>
                        <span className="text-[15px] text-on-surface-variant">{x.role?.name}</span>
                      </span>
                      <span className="flex flex-none items-center gap-1 text-[15px] font-bold text-primary">{isOpen ? 'Hide' : 'How?'}<ChevronDown size={18} className={cn('transition-transform', isOpen && 'rotate-180')} /></span>
                    </button>
                  </div>
                  {isOpen && (
                    <div className="flex flex-col gap-4 px-5 pb-5 pl-[68px] text-[17px] leading-relaxed">
                      {x.isCheck && (
                        <p className="m-0 rounded-xl bg-[#FFF7E6] px-4 py-3">
                          <b>This is a question.</b> If the answer is yes, tick it and carry on.
                          {x.no && <> If the answer is no: <b>{ifNo ? `${x.no.label} first` : `go back to “${x.no.label}”`}</b>.</>}
                        </p>
                      )}
                      {x.st.why && <p className="m-0"><b>Why:</b> {x.st.why}</p>}
                      <div><b>What to do</b>
                        {x.st.how?.length ? (
                          <ul className="m-0 mt-1 list-disc pl-6">{x.st.how.map((h, i) => <li key={i} className="mb-1">{h}</li>)}</ul>
                        ) : <p className="m-0 mt-1 text-on-surface-variant">Ask {proc.owner} — no instructions added yet.</p>}
                      </div>
                      {x.docs.length > 0 && (
                        <div><b>You'll need</b>
                          <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
                            {x.docs.map((d) => (
                              <li key={d.it.id}>
                                <ResourceLink it={d.it} className="inline-flex items-center gap-2 font-semibold text-primary"><FileText size={17} aria-hidden />{d.it.title}</ResourceLink>
                                {d.must && <span className="ml-2 text-[14px] text-on-surface-variant">(must have)</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
        <p className="m-0 px-1 text-[15px] text-on-surface-variant">Questions? Ask {proc.owner}, who looks after this process.</p>
      </div>
    </div>
  )
}
