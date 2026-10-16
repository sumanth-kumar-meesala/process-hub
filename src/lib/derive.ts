import type { Process, Role, RoleKind, SceneKind, Stage } from './types'

export const stageRoles = (p: Process, s: Stage): Role[] => {
  const ids = new Set<string>(s.roleIds)
  p.steps.filter((x) => x.stageId === s.id && x.kind !== 'start' && x.kind !== 'end').forEach((x) => ids.add(x.roleId))
  return p.roles.filter((r) => ids.has(r.id))
}

export const allSystems = (p: Process) => [...new Set(p.stages.flatMap((s) => s.systems))]

export const roleStages = (p: Process, roleName: string) => {
  const role = p.roles.find((r) => r.name === roleName)
  if (!role) return []
  return p.stages.map((s, i) => ({ s, i })).filter(({ s }) => stageRoles(p, s).some((r) => r.id === role.id))
}

export const stepCount = (p: Process) => p.steps.filter((s) => s.kind === 'step' || s.kind === 'decision').length

/** Pick a 3D scene for a stage from its words, unless the builder chose one. */
export const sceneFor = (s: Stage): Exclude<SceneKind, 'auto'> => {
  if (s.scene && s.scene !== 'auto') return s.scene
  const t = `${s.title} ${s.short} ${s.place}`.toLowerCase()
  if (/\bai\b|agent|automat|transcrib/.test(t)) return 'ai'
  if (/home|client|request|identify|need/.test(t)) return 'home'
  if (/approv|plan|office|review|sign/.test(t)) return 'office'
  if (/book|arrang|schedul|calendar|cover/.test(t)) return 'calendar'
  if (/train|deliver|session|assess|week|learn/.test(t)) return 'classroom'
  if (/pay|invoice|salary|bank|money/.test(t)) return 'payment'
  if (/ship|goods|receipt|parcel|courier|equipment/.test(t)) return 'delivery'
  if (/record|monitor|system|data|access|it /.test(t)) return 'records'
  return 'generic'
}

export const procPath = (p: Process) => `/process/${p.id}`
export const displayName = (p: Process) => (p.code ? `${p.code} · ${p.title}` : p.title)

/** A role's kind; names like "AI assistant" or "Summary agent" count as AI agents unless set otherwise. */
export const roleKind = (r: Role): RoleKind =>
  r.kind ?? (/\b(ai|agent|bot|assistant|copilot|llm|automation)\b/i.test(r.name) ? 'agent' : 'person')

export interface Loop { from: number; to: number; fromStep: string; toStep: string; label: string }
/** "No" paths (or any link) that go back to an earlier stage, or repeat inside the same stage. */
export const loopsOf = (p: Process): Loop[] => {
  const idx = (stepId: string) => p.stages.findIndex((s) => s.id === p.steps.find((x) => x.id === stepId)?.stageId)
  const order = new Map(p.steps.map((s, i) => [s.id, i]))
  const seen = new Set<string>()
  return p.edges.flatMap((e) => {
    const a = idx(e.from), b = idx(e.to)
    if (a < 0 || b < 0) return []
    const back = b < a || (a === b && (order.get(e.to) ?? 0) < (order.get(e.from) ?? 0))
    if (!back) return []
    const key = `${a}-${b}`
    if (seen.has(key)) return []
    seen.add(key)
    const toStep = p.steps.find((x) => x.id === e.to)?.label ?? ''
    return [{ from: a, to: b, fromStep: p.steps.find((x) => x.id === e.from)?.label ?? '', toStep, label: e.label ?? '' }]
  })
}
