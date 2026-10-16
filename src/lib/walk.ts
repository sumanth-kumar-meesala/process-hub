import { useEffect, useState } from 'react'
import type { Process, Step } from './types'

/** "Walk it with me": where the walker is, what they've done, and the path they actually took. */
export interface WalkState {
  started: boolean
  current?: string
  done: string[]
  trail: { from: string; to: string; label?: string }[]
  finished: boolean
  /** bumps whenever a stage is finished, to fire the confetti */
  nonce: number
}
const EMPTY: WalkState = { started: false, done: [], trail: [], finished: false, nonce: 0 }

const work = (s?: Step) => !!s && (s.kind === 'step' || s.kind === 'decision')
export const workSteps = (p: Process) => p.steps.filter(work)

export function firstStep(p: Process) {
  const start = p.steps.find((s) => s.kind === 'start')
  const viaEdge = start && p.edges.find((e) => e.from === start.id)?.to
  return viaEdge && work(p.steps.find((s) => s.id === viaEdge)) ? viaEdge : workSteps(p)[0]?.id
}

/** The next step after `id`. For a check, `answer` picks the Yes or No path. */
export function nextStep(p: Process, id: string, answer?: 'yes' | 'no') {
  const out = p.edges.filter((e) => e.from === id)
  const isNo = (l?: string) => /^no$/i.test(l ?? '')
  const pick = answer === 'no' ? out.find((e) => isNo(e.label))
    : answer === 'yes' ? out.find((e) => /^yes$/i.test(e.label ?? '')) ?? out.find((e) => !isNo(e.label))
    : out.find((e) => !isNo(e.label))
  if (pick) return { to: pick.to, label: pick.label }
  // no link drawn: carry on with the next step in order
  const all = workSteps(p), i = all.findIndex((s) => s.id === id)
  return all[i + 1] ? { to: all[i + 1].id, label: undefined } : undefined
}

const stageOf = (p: Process, id?: string) => p.steps.find((s) => s.id === id)?.stageId

export function useWalk(p: Process) {
  const key = `ph-walk-${p.id}`
  const [w, setW] = useState<WalkState>(() => {
    try {
      const raw = localStorage.getItem(key)
      const saved: WalkState = raw ? { ...EMPTY, ...JSON.parse(raw), nonce: 0 } : EMPTY
      // the process changed since this walk was saved: start again
      if (saved.current && !p.steps.some((x) => x.id === saved.current)) return EMPTY
      return saved
    } catch { return EMPTY }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(w)) } catch { /* private mode: keep it in memory */ } }, [key, w])

  const start = () => setW({ ...EMPTY, started: true, current: firstStep(p) })
  const advance = (answer?: 'yes' | 'no') => setW((s) => {
    if (!s.current) return s
    const nx = nextStep(p, s.current, answer)
    const done = s.done.includes(s.current) ? s.done : [...s.done, s.current]
    const target = nx && p.steps.find((x) => x.id === nx.to)
    if (!nx || !target || target.kind === 'end') return { ...s, done, finished: true, current: undefined, trail: nx ? [...s.trail, { from: s.current, ...nx }] : s.trail, nonce: s.nonce + 1 }
    const changedStage = stageOf(p, nx.to) !== stageOf(p, s.current)
    // going back on "No": that step needs doing again
    const redo = answer === 'no' ? done.filter((d) => d !== nx.to) : done
    return { ...s, done: redo, current: nx.to, trail: [...s.trail, { from: s.current, ...nx }], nonce: changedStage && answer !== 'no' ? s.nonce + 1 : s.nonce }
  })
  const back = () => setW((s) => {
    const last = s.trail[s.trail.length - 1]
    if (!last) return s
    return { ...s, finished: false, current: last.from, done: s.done.filter((d) => d !== last.from), trail: s.trail.slice(0, -1) }
  })
  const reset = () => setW(EMPTY)
  const total = workSteps(p).length
  const doneCount = new Set(s_done(w)).size
  return { walk: w, start, advance, back, reset, total, doneCount, wentBack: w.trail.filter((t) => /^no$/i.test(t.label ?? '')).length }
}
const s_done = (w: WalkState) => w.done

export const savedWalk = (id: string): WalkState | null => {
  try { const raw = localStorage.getItem(`ph-walk-${id}`); return raw ? JSON.parse(raw) : null } catch { return null }
}
