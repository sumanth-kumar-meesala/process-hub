export type Persona = 'performer' | 'leader' | 'owner' | 'executive' | 'admin'

export const PERSONAS: { id: Persona; label: string; blurb: string }[] = [
  { id: 'performer', label: 'Process Performer', blurb: 'Views processes and their own steps' },
  { id: 'leader', label: 'People Leader', blurb: "Also sees their team's roles" },
  { id: 'owner', label: 'Process Owner', blurb: 'Builds and publishes their own processes' },
  { id: 'executive', label: 'Executive', blurb: 'Sees the big-picture landscape' },
  { id: 'admin', label: 'Global Admin', blurb: 'Everything, plus settings' },
]

/** What a stage island shows in 3D. 'auto' picks one from the stage's words. */
export type SceneKind = 'auto' | 'home' | 'office' | 'calendar' | 'classroom' | 'records' | 'payment' | 'delivery' | 'generic'

export interface Role { id: string; name: string; color: string }

export interface Stage {
  id: string
  title: string
  /** short label used under islands and in the journey bar */
  short: string
  place: string
  text: string
  color: string
  systems: string[]
  docs: string[]
  /** roles that act here even if no step is drawn yet */
  roleIds: string[]
  scene: SceneKind
}

export type StepKind = 'step' | 'decision' | 'start' | 'end'

export interface Step {
  id: string
  kind: StepKind
  label: string
  roleId: string
  stageId: string
}

export interface Edge { id: string; from: string; to: string; label?: string }

export interface ResourceGroup { id: string; title: string; note: string; color: string; items: string[] }

export interface RoleDetail {
  roleId: string
  summary: string
  responsibilities: string[]
  byTrigger: { trigger: string; color: string; actions: { text: string; system: string }[] }[]
  rules: string[]
  systems: string[]
  documents: string[]
  policies: string[]
}

export interface OwnerDetail {
  processMaps: number
  activities: number
  pendingChanges: number
  scope: string[]
  outcomes: string[]
  risks: string[]
  accountable: string[]
  consulted: string[]
  approves: string[]
  upstream: string[]
  downstream: string[]
  controls: string[]
  changes: { date: string; text: string }[]
  raci: { role: string; level: 'Responsible' | 'Accountable' | 'Consulted' | 'Informed' }[]
}

export interface Process {
  id: string
  code?: string
  title: string
  area: string
  summary: string
  nutshell: string
  owner: string
  executiveOwner?: string
  reviewLast?: string
  reviewNext?: string
  status: 'published' | 'draft'
  /** true when the owner still has to fill it in (only partial info was available) */
  needsCompleting: boolean
  audience?: string
  triggers: string[]
  outcomes: string[]
  roles: Role[]
  stages: Stage[]
  steps: Step[]
  edges: Edge[]
  resources: ResourceGroup[]
  roleDetails: RoleDetail[]
  ownerDetail?: OwnerDetail
  /** where the builder placed things, keyed by step id */
  layout?: Record<string, { x: number; y: number }>
  updatedAt: string
  seeded?: boolean
}

export const STAGE_COLORS = ['#2563EB', '#DB2777', '#16A34A', '#EA580C', '#7C3AED', '#0891B2', '#CA8A04', '#DC2626']
export const ROLE_COLORS = ['#7C3AED', '#2563EB', '#0EA5E9', '#F97316', '#15803D', '#DB2777', '#CA8A04', '#0F766E', '#DC2626', '#4F46E5']

export const tint = (hex: string, a = 0.12) => {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  // blend with white
  const m = (c: number) => Math.round(c * a + 255 * (1 - a))
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`
