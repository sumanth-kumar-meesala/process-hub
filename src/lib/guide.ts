import { useEffect, useMemo, useState } from 'react'
import type { LibraryItem, Process, Role, Stage, Step } from './types'
import { firstStep, nextStep, usualPath, workSteps } from './walk'
import { stepResources } from './resources'

/**
 * Shared model for the guided process pages (Timeline, Checklist, One step at a time, List).
 * Everything comes from what was built in the Builder: stages, steps, checks, Yes/No links,
 * roles, linked library items and the optional "why", "how" and must-have fields.
 */
export interface GuideDoc { it: LibraryItem; must: boolean }
export interface GuideStep {
  st: Step
  stage: Stage
  stageIdx: number
  role?: Role
  isCheck: boolean
  /** on the usual path (every check says Yes) */
  onPath: boolean
  /** number in the usual order, counting only the chosen role's steps; null for "only if No" steps */
  n: number | null
  /** the step's number inside its stage, e.g. "2.3" (only for normal steps on the usual path; checks show "?") */
  local: string | null
  yes?: Step
  no?: Step
  /** "No" sends the work back to an earlier step */
  noBack: boolean
  /** a normal step that loops back to an earlier step afterwards */
  thenBack?: Step
  /** the next person, when the work changes hands after this step */
  handTo?: Role
  docs: GuideDoc[]
  mine: boolean
}

const isEnd = (p: Process, id?: string) => !id || p.steps.find((x) => x.id === id)?.kind === 'end'

export function buildGuide(p: Process, lib: LibraryItem[], roleId: string | null) {
  const work = workSteps(p)
  const order = (id?: string) => p.steps.findIndex((x) => x.id === id)
  const usual = usualPath(p)
  const usualIds = new Set(usual.map((x) => x.id))
  const mine = (s: Step) => !roleId || s.roleId === roleId
  const usualMine = usual.filter(mine)
  const byId = (id?: string) => p.steps.find((x) => x.id === id)
  const roleOf = (s?: Step) => p.roles.find((r) => r.id === s?.roleId)

  const steps: GuideStep[] = work.map((st) => {
    const stageIdx = Math.max(0, p.stages.findIndex((s) => s.id === st.stageId))
    const isCheck = st.kind === 'decision'
    const yesId = nextStep(p, st.id, isCheck ? 'yes' : undefined)?.to
    const yes = isEnd(p, yesId) ? undefined : byId(yesId)
    const noLink = isCheck ? p.edges.find((e) => e.from === st.id && /^no$/i.test(e.label ?? '')) : undefined
    const no = noLink && !isEnd(p, noLink.to) ? byId(noLink.to) : undefined
    const thenBack = !isCheck && yes && order(yes.id) < order(st.id) ? yes : undefined
    const handTo = yes && !thenBack && yes.roleId !== st.roleId ? roleOf(yes) : undefined
    const must = new Set(st.mustIds ?? [])
    const docs = stepResources(st, lib).map((it) => ({ it, must: must.has(it.id) })).sort((a, b) => Number(b.must) - Number(a.must))
    const i = usualMine.findIndex((x) => x.id === st.id)
    return {
      st, stage: p.stages[stageIdx], stageIdx, role: roleOf(st), isCheck, onPath: usualIds.has(st.id), n: i >= 0 ? i + 1 : null, local: null,
      yes, no, noBack: !!no && order(no.id) < order(st.id), thenBack, handTo, docs, mine: mine(st),
    }
  })
  // number each stage's normal steps on the usual path 1, 2, 3… within the stage, shown as "stage.step"
  p.stages.forEach((_, k) => { let c = 0; steps.forEach((g) => { if (g.stageIdx === k && g.onPath && !g.isCheck) g.local = `${k + 1}.${++c}` }) })
  const get = (id?: string) => steps.find((g) => g.st.id === id)
  const stages = p.stages.map((stage, k) => {
    const all = steps.filter((g) => g.stageIdx === k)
    return { stage, k, all, usual: all.filter((g) => g.onPath), mine: all.filter((g) => g.mine) }
  })
  /** first of this role's steps at or after `id`, and the other people's steps passed on the way */
  const forward = (id?: string) => {
    const passed: GuideStep[] = []; const seen = new Set<string>()
    let cur = get(id)
    while (cur && !seen.has(cur.st.id)) {
      seen.add(cur.st.id)
      if (cur.mine) return { id: cur.st.id, passed }
      passed.push(cur)
      cur = get(cur.yes?.id)
    }
    return { id: undefined, passed }
  }
  /** the steps that are "only when a check says No", for one check */
  const usedIn = (itemId: string, exceptId: string) => steps.filter((g) => g.st.id !== exceptId && g.docs.some((d) => d.it.id === itemId)).map((g) => g.st.label)
  return { steps, stages, get, forward, usedIn, total: usualMine.length, start: forward(firstStep(p)).id ?? firstStep(p) }
}
export type Guide = ReturnType<typeof buildGuide>

interface GuideState { role: string | null; cur?: string; done: string[]; hist: string[]; finished: boolean; handoff: string }
const EMPTY: GuideState = { role: null, done: [], hist: [], finished: false, handoff: '' }

/** Where the reader is in a process. Saved per process, so it's the same in every guided view. */
export function useGuide(p: Process, lib: LibraryItem[]) {
  const key = `ph-guide-${p.id}`
  const [s, setS] = useState<GuideState>(() => {
    try {
      const raw = localStorage.getItem(key)
      const saved: GuideState = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
      if (saved.cur && !p.steps.some((x) => x.id === saved.cur)) return EMPTY
      if (saved.role && !p.roles.some((r) => r.id === saved.role)) return EMPTY
      return saved
    } catch { return EMPTY }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(s)) } catch { /* private mode: keep it in memory */ } }, [key, s])
  const g = useMemo(() => buildGuide(p, lib, s.role), [p, lib, s.role])
  const cur = g.get(s.cur) ?? g.get(g.start) ?? g.steps[0]

  const select = (id: string) => setS((x) => ({ ...x, cur: id, finished: false, handoff: '', hist: x.cur && x.cur !== id ? [...x.hist, x.cur] : x.hist }))
  const go = (answer?: 'yes' | 'no') => {
    if (!cur) return
    const nextId = answer === 'no' ? cur.no?.id : cur.yes?.id
    const { id, passed } = g.forward(nextId)
    const names = [...new Set(passed.map((x) => x.role?.name ?? 'someone else'))]
    setS((x) => {
      const done = [...new Set([...x.done.filter((d) => answer !== 'no' || d !== nextId), cur.st.id, ...passed.map((q) => q.st.id)])]
      const handoff = passed.length ? `Meanwhile ${names.join(', ')} ${names.length > 1 ? 'do' : 'does'} ${passed.length} step${passed.length > 1 ? 's' : ''}. Here's your next one.` : ''
      return id ? { ...x, done, cur: id, hist: [...x.hist, cur.st.id], finished: false, handoff } : { ...x, done, hist: [...x.hist, cur.st.id], finished: true, handoff: '' }
    })
  }
  const back = () => setS((x) => {
    const hist = [...x.hist]; const prev = hist.pop()
    return prev ? { ...x, cur: prev, hist, done: x.done.filter((d) => d !== prev), finished: false, handoff: '' } : x
  })
  const setRole = (role: string | null) => {
    const ng = buildGuide(p, lib, role)
    setS({ ...EMPTY, role, cur: ng.start })
  }
  const restart = () => setS((x) => ({ ...EMPTY, role: x.role, cur: g.start }))
  const toggleDone = (id: string) => setS((x) => ({ ...x, done: x.done.includes(id) ? x.done.filter((d) => d !== id) : [...x.done, id] }))

  const usualMine = g.steps.filter((x) => x.onPath && x.mine)
  const doneCount = s.finished ? usualMine.length : usualMine.filter((x) => s.done.includes(x.st.id)).length
  return {
    g, cur, role: s.role, roleObj: p.roles.find((r) => r.id === s.role), done: new Set(s.done), finished: s.finished, handoff: s.handoff,
    canBack: s.hist.length > 0, total: usualMine.length, doneCount, pct: Math.round((doneCount / Math.max(1, usualMine.length)) * 100),
    select, go, back, setRole, restart, toggleDone,
  }
}
export type GuideRun = ReturnType<typeof useGuide>
