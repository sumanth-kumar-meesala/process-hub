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

/** The steps the work goes through when every check says "Yes" — the usual path, in order. */
export function usualPath(p: Process): Step[] {
  const out: Step[] = [], seen = new Set<string>()
  let id: string | undefined = firstStep(p)
  while (id && !seen.has(id)) {
    const st = p.steps.find((x) => x.id === id)
    if (!st || !work(st)) break
    seen.add(id); out.push(st)
    id = nextStep(p, id, st.kind === 'decision' ? 'yes' : undefined)?.to
  }
  return out
}

export interface Handoff {
  /** other people's steps, in the order the work goes through them (taking "Yes" at their checks) */
  steps: Step[]
  /** the next step for this role, or undefined when the process ends first */
  target?: string
  /** checks by others that can send the work back to this role */
  warnings: { check: Step; backTo: Step }[]
}

/** From `fromId`, follow the work through other people's steps until it reaches `roleId` again (or the end). */
export function handoffRun(p: Process, fromId: string, roleId: string): Handoff {
  const byId = (id?: string) => p.steps.find((x) => x.id === id)
  const steps: Step[] = [], warnings: Handoff['warnings'] = [], seen = new Set<string>()
  let cur = byId(fromId)
  while (cur && work(cur) && cur.roleId !== roleId && !seen.has(cur.id)) {
    seen.add(cur.id); steps.push(cur)
    if (cur.kind === 'decision') {
      // where does "No" lead? if it reaches this role's step before coming back, warn them
      let n = nextStep(p, cur.id, 'no'), hops = 0
      const back = new Set<string>([cur.id])
      while (n && hops++ < 8 && !back.has(n.to)) {
        const t = byId(n.to)
        if (!t || !work(t)) break
        if (t.roleId === roleId) { warnings.push({ check: cur, backTo: t }); break }
        back.add(t.id); n = nextStep(p, t.id)
      }
    }
    const nx = nextStep(p, cur.id, cur.kind === 'decision' ? 'yes' : undefined)
    cur = nx ? byId(nx.to) : undefined
  }
  return { steps, target: cur && work(cur) && cur.roleId === roleId ? cur.id : undefined, warnings }
}

/** `roleId`: walk only this role's steps (other people's are summed up as hand-offs). Progress is saved per role. */
export function useWalk(p: Process, roleId: string | null = null) {
  const key = `ph-walk-${p.id}${roleId ? `-${roleId}` : ''}`
  const load = (): WalkState => {
    try {
      const raw = localStorage.getItem(key)
      const saved: WalkState = raw ? { ...EMPTY, ...JSON.parse(raw), nonce: 0 } : EMPTY
      // the process changed since this walk was saved: start again
      if (saved.current && !p.steps.some((x) => x.id === saved.current)) return EMPTY
      return saved
    } catch { return EMPTY }
  }
  const [state, setState] = useState<{ key: string; w: WalkState }>(() => ({ key, w: load() }))
  // switching role (or between "my steps" and "whole process") picks up that walk's own saved progress
  const w = state.key === key ? state.w : load()
  useEffect(() => { if (state.key !== key) setState({ key, w: load() }) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const setW = (fn: WalkState | ((s: WalkState) => WalkState)) => setState((st) => {
    const cur = st.key === key ? st.w : load()
    return { key, w: typeof fn === 'function' ? fn(cur) : fn }
  })
  useEffect(() => { if (state.key === key) try { localStorage.setItem(key, JSON.stringify(state.w)) } catch { /* private mode: keep it in memory */ } }, [key, state])

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
  /** Jump over a hand-off: other people's steps count as done, and the walk carries on at `target` (or finishes). */
  const skipTo = (run: Handoff) => setW((s) => {
    if (!s.current || !run.steps.length) return s
    const ids = run.steps.map((x) => x.id)
    const hops = run.steps.map((x, i) => ({ from: x.id, to: run.steps[i + 1]?.id ?? run.target ?? 'end' }))
    const done = [...new Set([...s.done, ...ids])]
    if (!run.target) return { ...s, done, finished: true, current: undefined, trail: [...s.trail, ...hops], nonce: s.nonce + 1 }
    return { ...s, done, current: run.target, trail: [...s.trail, ...hops], nonce: stageOf(p, run.target) !== stageOf(p, s.current) ? s.nonce + 1 : s.nonce }
  })
  const reset = () => setW(EMPTY)
  // count the steps on the path this walk takes: the usual path, plus any extra steps a "No" sent you through
  const usual = usualPath(p)
  const onPath = new Set([...usual.map((x) => x.id), ...w.done, ...(w.current ? [w.current] : [])])
  const mineIds = new Set(workSteps(p).filter((x) => onPath.has(x.id) && (!roleId || x.roleId === roleId)).map((x) => x.id))
  const total = mineIds.size
  const doneCount = w.finished ? total : [...mineIds].filter((id) => w.done.includes(id)).length
  /** steps that only happen when a check says "No" (not walked this time) */
  const offPath = workSteps(p).filter((x) => !onPath.has(x.id) && (!roleId || x.roleId === roleId))
  const handoff = roleId && w.current && p.steps.find((x) => x.id === w.current)?.roleId !== roleId ? handoffRun(p, w.current, roleId) : null
  return { walk: w, start, advance, back, reset, skipTo, handoff, roleId, total, doneCount, offPath, pathIds: mineIds, wentBack: w.trail.filter((t) => /^no$/i.test(t.label ?? '')).length }
}

export const savedWalk = (id: string): WalkState | null => {
  try { const raw = localStorage.getItem(`ph-walk-${id}`); return raw ? JSON.parse(raw) : null } catch { return null }
}
