import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FileText, UsersRound } from 'lucide-react'
import { ResourceLink } from '@/components/process/ResourceLink'
import { Terms } from '@/components/Terms'
import type { GuideViewProps } from './views'

/** One step per screen: pick who you are, then just the step in front of you and one big button. */
export default function StepsView({ proc, run }: GuideViewProps) {
  const [picked, setPicked] = useState(() => run.role !== null || run.done.size > 0 || run.finished)
  const top = useRef<HTMLDivElement>(null)
  const cur = run.cur
  useEffect(() => { top.current?.scrollTo({ top: 0 }) }, [cur?.st.id, run.finished, picked])

  const choose = (role: string | null) => { run.setRole(role); setPicked(true) }
  const btnBig = 'flex h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 text-[20px] font-bold text-white'

  return (
    <div ref={top} className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-7 px-4 pb-16 pt-4">
        {!picked ? (
          <section className="flex flex-col gap-5 rounded-[28px] bg-white p-7">
            <h2 className="m-0 text-[34px] font-extrabold leading-tight">Who are you?</h2>
            <p className="m-0 text-[18px] text-on-surface-variant">We'll show you only the steps you do, one at a time.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {proc.roles.map((r) => (
                <button key={r.id} onClick={() => choose(r.id)} className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-outline-variant bg-white px-5 text-left text-[18px] font-bold text-on-surface hover:border-primary">
                  <span className="h-3 w-3 flex-none rounded-full" style={{ background: r.color }} />{r.name}
                </button>
              ))}
              <button onClick={() => choose(null)} className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-outline-variant bg-white px-5 text-left text-[18px] font-bold text-on-surface-variant hover:border-primary">
                <UsersRound size={20} />Show me every step
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px]">
                <span className="text-on-surface-variant">Steps for <b className="text-on-surface">{run.roleObj?.name ?? 'everyone'}</b></span>
                <button onClick={() => setPicked(false)} className="cursor-pointer border-0 bg-transparent p-0 text-[16px] text-primary underline">change</button>
                <span className="flex-1" />
                <span className="text-on-surface-variant">{run.finished ? `All ${run.total} done` : `${run.doneCount} of ${run.total} done`}</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-mid"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${run.finished ? 100 : run.pct}%` }} /></div>
            </div>

            {run.finished && (
              <section className="flex flex-col items-start gap-4 rounded-[28px] bg-white p-8">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#16A34A] text-white"><Check size={34} strokeWidth={3} /></span>
                <h2 className="m-0 text-[32px] font-extrabold">All done!</h2>
                <p className="m-0 text-[18px] leading-relaxed text-on-surface-variant">{run.roleObj ? `That's all of your part as ${run.roleObj.name}.` : "That's the whole process."} Thank you.</p>
                <button onClick={run.restart} className={`${btnBig} bg-primary sm:w-auto sm:px-8`}>Start again</button>
              </section>
            )}

            {cur && !run.finished && (
              <section className="flex flex-col gap-7 rounded-[28px] bg-white p-7">
                <div className="flex flex-col gap-2">
                  <span className="text-[17px] font-bold text-primary">{cur.n ? `Step ${cur.n} of ${run.total}` : 'An extra step, because the answer was no'}</span>
                  <h2 className="m-0 text-[36px] font-extrabold leading-tight tracking-[-0.01em]"><Terms text={cur.st.label} /></h2>
                  <span className="text-[17px] text-on-surface-variant">Who does this: <b className="text-on-surface">{cur.role?.name ?? '—'}</b></span>
                </div>
                {run.handoff && <p className="m-0 rounded-2xl bg-primary-container px-5 py-3.5 text-[17px] leading-relaxed text-on-primary-container">{run.handoff}</p>}

                <div className="flex flex-col gap-3">
                  <h3 className="m-0 text-[21px] font-extrabold">What to do</h3>
                  {cur.st.how?.length ? cur.st.how.map((h, i) => (
                    <div key={i} className="flex items-start gap-3.5 text-[18px] leading-relaxed">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-low text-[15px] font-extrabold">{i + 1}</span><span className="pt-0.5">{h}</span>
                    </div>
                  )) : <p className="m-0 text-[17px] text-on-surface-variant">Ask {proc.owner} — no instructions have been added yet.</p>}
                  {cur.st.why && <p className="m-0 text-[16px] text-on-surface-variant">Why: {cur.st.why}</p>}
                </div>

                {cur.docs.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <h3 className="m-0 text-[21px] font-extrabold">You'll need</h3>
                    {cur.docs.map((d) => (
                      <ResourceLink key={d.it.id} it={d.it} className="flex items-center gap-3 rounded-2xl border-2 border-outline-variant px-4 py-3.5 text-[17px] font-bold text-on-surface no-underline hover:border-primary">
                        <FileText size={22} className="flex-none text-primary" aria-hidden /><span className="flex-1">{d.it.title}</span><span className="text-[15px] text-primary">Open</span>
                      </ResourceLink>
                    ))}
                  </div>
                )}

                {cur.isCheck ? (
                  <div className="flex flex-col gap-3">
                    <span className="text-[20px] font-extrabold">What's the answer?</span>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => run.go('yes')} className={`${btnBig} bg-[#16A34A] hover:bg-[#15803D]`}>Yes</button>
                      <button onClick={() => run.go('no')} className={`${btnBig} bg-error hover:bg-[#912018]`}>No</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => run.go()} className={`${btnBig} bg-primary hover:bg-[#1a44c0]`}>Done — next step<ArrowRight size={22} /></button>
                )}
                {run.canBack && (
                  <button onClick={run.back} className="inline-flex cursor-pointer items-center gap-1.5 self-start border-0 bg-transparent p-0 text-[17px] text-on-surface-variant underline"><ArrowLeft size={17} />Go back</button>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
