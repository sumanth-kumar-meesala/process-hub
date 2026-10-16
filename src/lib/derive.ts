import type { Process, Role, SceneKind, Stage } from './types'

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
