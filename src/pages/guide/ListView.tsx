import { useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight, Check, FileText } from 'lucide-react'
import { ResourceLink } from '@/components/process/ResourceLink'
import { Terms } from '@/components/Terms'
import { cn } from '@/lib/utils'
import type { GuideViewProps } from './views'

/** List: a plain numbered list of the steps on the left, the chosen step on the right with one big button. */
export default function ListView({ proc, run }: GuideViewProps) {
  const { g, cur } = run
  const listRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 })
    const box = listRef.current, row = cur && document.getElementById(`ls-${cur.st.id}`)
    if (!box || !row) return
    const b = box.getBoundingClientRect(), r = row.getBoundingClientRect()
    if (r.top < b.top || r.bottom > b.bottom) box.scrollBy({ top: r.top - b.top - b.height / 3, behavior: 'smooth' })
  }, [cur?.st.id, run.finished])
  const rows = g.stages.map((s) => ({ ...s, items: s.usual.filter((x) => x.mine) })).filter((s) => s.items.length)
  const big = 'flex h-[60px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 px-7 text-[19px] font-bold text-white'

  return (
    <div className="mx-auto flex h-full w-full max-w-[1200px] gap-6 px-3 pb-4 sm:px-6 max-[899px]:h-auto max-[899px]:flex-col">
      <nav ref={listRef} aria-label="Steps" className="flex min-h-0 w-[380px] flex-none flex-col gap-4 overflow-y-auto overscroll-contain rounded-[28px] bg-white p-4 max-[899px]:w-full max-[899px]:overflow-visible">
        <div className="px-2 text-[16px] text-on-surface-variant">{run.finished ? `All ${run.total} done` : `${run.doneCount} of ${run.total} done`}</div>
        {rows.map((s) => (
          <div key={s.stage.id} className="flex flex-col gap-0.5">
            <h2 className="m-0 mb-1 px-3 text-[14px] font-extrabold uppercase tracking-[0.05em] text-on-surface-variant">{s.stage.short || s.stage.title}</h2>
            {s.items.map((x) => {
              const isCur = !run.finished && cur?.st.id === x.st.id
              const isDone = run.done.has(x.st.id)
              return (
                <button key={x.st.id} id={`ls-${x.st.id}`} onClick={() => run.select(x.st.id)} aria-current={isCur ? 'step' : undefined}
                  className={cn('flex w-full cursor-pointer items-center gap-3.5 rounded-xl border-0 px-3 py-3 text-left text-[16px] leading-snug', isCur ? 'bg-primary-container font-bold text-on-primary-container' : 'bg-transparent font-medium text-on-surface hover:bg-surface-low')}>
                  <span className={cn('flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] font-extrabold', isDone ? 'bg-[#16A34A] text-white' : isCur ? 'bg-primary text-white' : 'bg-surface-low')}>
                    {isDone ? <Check size={16} strokeWidth={3} /> : x.n}
                  </span>
                  {x.st.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <main ref={detailRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain max-[899px]:overflow-visible">
        {run.finished ? (
          <section className="flex flex-col items-start gap-4 rounded-[28px] bg-white p-9">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#16A34A] text-white"><Check size={34} strokeWidth={3} /></span>
            <h2 className="m-0 text-[30px] font-extrabold">All done!</h2>
            <p className="m-0 text-[18px] text-on-surface-variant">{run.roleObj ? `That's all of your part as ${run.roleObj.name}.` : "That's the whole process."}</p>
            <button onClick={run.restart} className={`${big} bg-primary`}>Start again</button>
          </section>
        ) : cur && (
          <section className="flex flex-col gap-7 rounded-[28px] bg-white p-7 sm:p-9">
            <div className="flex flex-col gap-2">
              <span className="text-[16px] font-bold text-primary">{cur.n ? `Step ${cur.n} of ${run.total}` : 'An extra step, because the answer was no'}</span>
              <h2 className="m-0 text-[34px] font-extrabold leading-tight tracking-[-0.01em]"><Terms text={cur.st.label} /></h2>
              <span className="text-[17px] text-on-surface-variant">Who does this: <b className="text-on-surface">{cur.role?.name ?? '—'}</b></span>
            </div>
            {run.handoff && <p className="m-0 rounded-2xl bg-primary-container px-5 py-3.5 text-[17px] text-on-primary-container">{run.handoff}</p>}

            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-[20px] font-extrabold">What to do</h3>
              {cur.st.how?.length ? cur.st.how.map((h, i) => (
                <div key={i} className="flex items-start gap-3.5 text-[18px] leading-relaxed">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-low text-[15px] font-extrabold">{i + 1}</span><span className="pt-0.5">{h}</span>
                </div>
              )) : <p className="m-0 text-[17px] text-on-surface-variant">Ask {proc.owner} — no instructions have been added yet.</p>}
              {cur.st.why && <p className="m-0 text-[16px] text-on-surface-variant">Why: {cur.st.why}</p>}
            </div>

            {cur.docs.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h3 className="m-0 text-[20px] font-extrabold">You'll need</h3>
                {cur.docs.map((d) => (
                  <ResourceLink key={d.it.id} it={d.it} className="flex items-center gap-3 rounded-2xl border-2 border-outline-variant px-4 py-3.5 text-[17px] font-bold text-on-surface no-underline hover:border-primary">
                    <FileText size={22} className="flex-none text-primary" aria-hidden /><span className="flex-1">{d.it.title}</span><span className="text-[15px] text-primary">Open</span>
                  </ResourceLink>
                ))}
              </div>
            )}

            {cur.isCheck && (
              <div className="flex flex-col gap-3">
                <span className="text-[19px] font-extrabold">What's the answer?</span>
                <div className="flex gap-3">
                  <button onClick={() => run.go('yes')} className={`${big} flex-1 bg-[#16A34A] hover:bg-[#15803D]`}>Yes</button>
                  <button onClick={() => run.go('no')} className={`${big} flex-1 bg-error hover:bg-[#912018]`}>No</button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              {run.canBack && <button onClick={run.back} className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[17px] text-on-surface-variant underline"><ArrowLeft size={17} />Go back</button>}
              <span className="flex-1" />
              {!cur.isCheck && <button onClick={() => run.go()} className={`${big} bg-primary hover:bg-[#1a44c0]`}>Done — next step<ArrowRight size={21} /></button>}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
