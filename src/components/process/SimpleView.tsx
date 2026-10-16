import { useEffect, useState } from 'react'
import { Bot, Check, ChevronDown, FileText, Plug, Undo2, X } from 'lucide-react'
import { Terms } from '@/components/Terms'
import { ResourceLink } from '@/components/process/ResourceLink'
import { roleKind, stageRoles, sysLabel, sysUnsure } from '@/lib/derive'
import { catOf, stepResources } from '@/lib/resources'
import type { Process } from '@/lib/types'
import { useData } from '@/store/store'
import { cn } from '@/lib/utils'

export interface SimpleWalk { done: Set<string>; current?: string; finished: boolean }

/**
 * The plain version of the 3D view: stages as a numbered list of steps.
 * Details (documents, "if not" paths, AI tools) open when a step is tapped.
 * Readable by screen readers and keyboards, works without 3D, and prints cleanly.
 */
export function SimpleView({ proc, role, onClearRole, walk, active, selStep, onStep, flash }: {
  proc: Process
  /** "Show me as": only this role's stages and steps are shown */
  role: string | null
  onClearRole: () => void
  walk: SimpleWalk | null
  active: number
  selStep: string | null
  onStep: (id: string) => void
  /** stage to scroll to and briefly highlight (e.g. "Show me stage 3") */
  flash: { k: number; n: number } | null
}) {
  const library = useData((s) => s.library)
  const [printing, setPrinting] = useState(false)
  const order = (id?: string) => proc.steps.findIndex((x) => x.id === id)
  const roleObj = proc.roles.find((r) => r.id === role)
  const work = (stageId: string) => proc.steps.filter((x) => x.stageId === stageId && (x.kind === 'step' || x.kind === 'decision'))
  const mineCount = role ? proc.steps.filter((x) => x.roleId === role && (x.kind === 'step' || x.kind === 'decision')).length : 0

  useEffect(() => {
    if (walk?.current) document.getElementById(`simple-step-${walk.current}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [walk?.current])
  useEffect(() => {
    if (flash) document.getElementById(`simple-stage-${flash.k}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [flash])
  // printing shows every step's details
  useEffect(() => {
    const before = () => setPrinting(true), after = () => setPrinting(false)
    window.addEventListener('beforeprint', before); window.addEventListener('afterprint', after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) }
  }, [])

  return (
    <div className="flex flex-col gap-4 rounded-[28px] bg-white px-4 py-5 sm:px-7 sm:py-6 print:p-0" aria-label={`${proc.title}, step by step`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="m-0 text-sm text-on-surface-variant"><b className="text-on-surface">Starts when:</b> {proc.triggers.join(' · ') || '—'}</p>
      </div>

      {roleObj && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 text-sm" style={{ background: `${roleObj.color}14` }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: roleObj.color }} />
          <span>Showing only what the <b>{roleObj.name}</b> does — {mineCount} step{mineCount === 1 ? '' : 's'}.</span>
          <button onClick={onClearRole} className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-white px-3 py-1 text-[13px] font-bold text-primary print:hidden"><X size={13} />Show everyone</button>
        </div>
      )}

      <ol className="m-0 flex list-none flex-col p-0">
        {proc.stages.map((s, k) => {
          const all = work(s.id)
          const steps = role ? all.filter((x) => x.roleId === role) : all
          if (role && !steps.length) return null
          const stageDone = !!walk && (walk.finished || (all.length > 0 && all.every((x) => walk.done.has(x.id))))
          const systems = s.systems.map((x) => sysLabel(x) + (sysUnsure(x) ? ' (?)' : ''))
          const who = stageRoles(proc, s).map((r) => r.name)
          const lit = k === active || flash?.k === k
          return (
            <li key={s.id} id={`simple-stage-${k}`} className="relative flex scroll-mt-4 gap-4 pb-6 last:pb-0 print:break-inside-avoid">
              {/* number and the line down to the next stage */}
              <div className="relative flex w-8 flex-none justify-center">
                <span className="absolute bottom-0 top-9 w-[2px] rounded bg-outline-variant" aria-hidden />
                <span className={cn('relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white', lit && 'ring-4')}
                  style={{ background: stageDone ? '#16A34A' : s.color, ['--tw-ring-color' as string]: `${s.color}33` }}>
                  {stageDone ? <Check size={16} strokeWidth={3} /> : k + 1}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
                <div>
                  <h3 className="m-0 text-[17px] font-extrabold leading-snug">{s.title}</h3>
                  <p className="m-0 text-[13px] text-on-surface-variant">
                    {s.place ? `At ${s.place}` : ''}{s.place && (who.length || systems.length) ? ' · ' : ''}
                    {!role && who.length ? who.join(', ') : ''}{!role && who.length && systems.length ? ' · ' : ''}
                    {systems.length ? <>in <Terms text={systems.join(', ')} /></> : ''}
                  </p>
                </div>

                {steps.length === 0 ? (
                  <p className="m-0 text-sm italic text-on-surface-variant">Steps not added yet — {proc.owner} is completing this stage.</p>
                ) : (
                  <ol className="m-0 flex list-none flex-col gap-1 p-0">
                    {steps.map((st) => {
                      const r = proc.roles.find((x) => x.id === st.roleId)
                      const dec = st.kind === 'decision'
                      const res = stepResources(st, library)
                      const noEdge = dec ? proc.edges.find((e) => e.from === st.id && /^no$/i.test(e.label ?? '')) : undefined
                      const noStep = noEdge && proc.steps.find((x) => x.id === noEdge.to)
                      const noStage = noStep ? proc.stages.findIndex((x) => x.id === noStep.stageId) : -1
                      const agent = !!r && roleKind(r) === 'agent'
                      const isDone = walk?.done.has(st.id)
                      const isCur = walk?.current === st.id
                      const hasMore = res.length > 0 || (dec && !!noStep) || (agent && !!r?.tools?.length)
                      const open = printing || selStep === st.id || isCur
                      const num = all.indexOf(st) + 1
                      return (
                        <li key={st.id} id={`simple-step-${st.id}`} className={cn('scroll-mt-24 rounded-xl transition-colors', isCur ? 'bg-[#FFF4DB] ring-2 ring-[#F59E0B]' : open ? 'bg-surface-low' : '')}>
                          <button onClick={() => onStep(st.id)} aria-expanded={hasMore ? open : undefined} aria-current={isCur ? 'step' : undefined}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-2.5 py-2 text-left hover:bg-surface-low">
                            <span className={cn('flex h-6 w-6 flex-none items-center justify-center text-[11px] font-extrabold', dec ? 'rotate-45 rounded-[5px]' : 'rounded-full',
                              isDone ? 'bg-[#16A34A] text-white' : dec ? 'bg-[#FDE68A] text-[#92400E]' : 'bg-surface-mid text-on-surface')}>
                              <span className={cn(dec && '-rotate-45')}>{isDone ? <Check size={13} strokeWidth={3} /> : dec ? '?' : num}</span>
                            </span>
                            <span className={cn('min-w-0 flex-1 text-[15px] leading-snug', isDone && !isCur && 'text-on-surface-variant')}>
                              <Terms text={st.label} />
                              {!role && <span className="text-[13px] text-on-surface-variant"> — {agent ? <><Bot size={12} className="inline align-[-1px]" aria-label="AI agent" /> </> : ''}{r?.name}</span>}
                            </span>
                            {isCur && <span className="flex-none rounded-full bg-[#F59E0B] px-2 py-0.5 text-[10px] font-extrabold text-white">YOU ARE HERE</span>}
                            {hasMore && !isCur && (
                              <span className="flex flex-none items-center gap-1 text-xs text-on-surface-variant print:hidden">
                                {res.length > 0 && <><FileText size={13} />{res.length}</>}
                                <ChevronDown size={15} className={cn('transition-transform', open && 'rotate-180')} />
                              </span>
                            )}
                          </button>
                          {open && hasMore && (
                            <div className="flex flex-col gap-1.5 pb-2.5 pl-[46px] pr-3 text-[13px]">
                              {dec && noStep && (
                                <span className="flex items-start gap-1.5 font-semibold text-[#9A3412]"><Undo2 size={13} className="mt-0.5 flex-none" />
                                  If not: {order(noStep.id) < order(st.id) ? 'back to ' : ''}“{noStep.label}”{noStage !== k && noStage >= 0 ? ` (stage ${noStage + 1})` : ''}</span>
                              )}
                              {agent && r?.tools?.length ? <span className="flex items-center gap-1.5 text-on-surface-variant"><Plug size={13} />Works automatically, using {r.tools.join(', ')}</span> : null}
                              {res.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {res.map((it) => (
                                    <ResourceLink key={it.id} it={it} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs font-semibold text-on-surface no-underline hover:border-primary">
                                      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: catOf(it.category).color }} />{it.title}
                                    </ResourceLink>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-outline-variant pt-3 text-sm text-on-surface-variant">
        <b className={cn('text-on-surface', walk?.finished && 'text-[#16A34A]')}>{walk?.finished ? '✓ Done when:' : 'Done when:'}</b>
        {proc.outcomes.join(' · ') || '[To be completed by the owner]'}
      </p>
    </div>
  )
}
