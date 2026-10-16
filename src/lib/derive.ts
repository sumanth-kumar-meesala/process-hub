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
/** What each 3D look means, and the words that point to it (checked in this order on a tie). */
export const SCENE_WORDS: [Exclude<SceneKind, 'auto' | 'generic'>, RegExp][] = [
  ['upload', /\b(upload|send(s|ing)? (it )?to (the )?ai|transfer (the )?file|sync|import|export)/g],
  ['recording', /\b(recording|audio|voice|microphone|dictat\w*|capture|record(s|ing)? (the )?(session|call|meeting|conversation))\b/g],
  ['ai', /\b(ai|agent|automat\w*|transcri\w*|summari[sz]\w*|llm|bot)\b/g],
  ['alert', /\b(incident\w*|exception\w*|escalat\w*|risk\w*|urgent\w*|error\w*|fail\w*|breach\w*|complain\w*|issue\w*|problem\w*)\b/g],
  ['consent', /\b(consent|privacy|confidential\w*|permission|secur\w*)\b/g],
  ['approval', /\b(approv\w*|sign[ -]?off|authoris\w*|authoriz\w*|endorse\w*|accept\w*)\b/g],
  ['review', /\b(review\w*|edit\w*|check\w*|verif\w*|quality|correct\w*|peer|proofread|validat\w*|accura\w*)\b/g],
  ['archive', /\b(archiv\w*|delet\w*|retention|dispos\w*|revok\w*|return (equipment|access)|remove access|close (the )?(file|case))\b/g],
  ['database', /\b(sav(e|ed|ing)|stor(e|ed|ing)|fil(e|ed|ing) (it|the|in|to)|update (the )?record|records?|lumary|database|crm|client file|note)\b/g],
  ['message', /\b(email\w*|notif\w*|send\w*|letter|invit\w*|messag\w*|outlook|inform\w*|remind\w*|tell)\b/g],
  ['handover', /\b(handover|hand over|hand-off|handoff|refer\w*|assign\w* to|pass(es)? (it )?to)\b/g],
  ['phone', /\b(call\w*|phone|ring|contact)\b/g],
  ['report', /\b(report\w*|dashboard|monitor\w*|kpi|metric\w*|analy\w*|track\w*|compliance|audit\w*)\b/g],
  ['meeting', /\b(meeting|discuss\w*|case conference|huddle|panel|team)\b/g],
  ['clinic', /\b(therapy|therapy session|clinic\w*|appointment|consult\w*|counsel\w*|treatment|assess\w*)\b/g],
  ['classroom', /\b(train\w*|course|learn\w*|workshop|induction|educat\w*)\b/g],
  ['calendar', /\b(book\w*|schedul\w*|calendar|arrang\w*|roster\w*|availab\w*|date)\b/g],
  ['payment', /\b(pay\w*|invoice\w*|salary|bank|money|claim\w*|fund\w*|budget|cost)\b/g],
  ['delivery', /\b(deliver(y|ies)? of|ship\w*|parcel|courier|equipment|goods|order\w*)\b/g],
  ['home', /\b(home|house|visit\w*|residen\w*)\b/g],
  ['office', /\b(office)\b/g],
  ['finish', /\b(close\w*|complet\w*|finish\w*|wrap\w*|done|final\w*)\b/g],
]

/** Picks the 3D look that best shows what happens in a stage: its name counts most, then its steps. */
export const sceneFor = (s: Stage, p?: Process): Exclude<SceneKind, 'auto'> => {
  if (s.scene && s.scene !== 'auto') return s.scene
  const steps = p ? p.steps.filter((x) => x.stageId === s.id && (x.kind === 'step' || x.kind === 'decision')).map((x) => x.label).join(' . ') : ''
  const parts: [string, number][] = [[`${s.title} . ${s.short}`, 3], [steps, 1], [s.place, 0.3], [s.text, 0.5]]
  let best: Exclude<SceneKind, 'auto'> = 'generic', top = 0
  SCENE_WORDS.forEach(([kind, re]) => {
    let sc = 0
    parts.forEach(([t, w]) => { sc += (t.toLowerCase().match(re)?.length ?? 0) * w })
    if (sc > top) { top = sc; best = kind }
  })
  return best
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

/** True for internal ids like "s_due8v4" that should never be shown as a name. */
export const idLike = (t?: string) => !!t && /^(s|st|stage|step)[_-][a-z0-9]{4,}$/i.test(t.trim())

/** Gives any stage that only has an internal id as its name a readable one (from its first step, or "Stage N"). */
export function fixStageNames(p: Process): Process {
  if (!p.stages.some((s) => idLike(s.short) || idLike(s.title) || !s.short?.trim())) return p
  return {
    ...p,
    stages: p.stages.map((s, i) => {
      const titleOk = s.title?.trim() && !idLike(s.title)
      const first = p.steps.find((x) => x.stageId === s.id && (x.kind === 'step' || x.kind === 'decision'))?.label
      const title = titleOk ? s.title : first ? first.replace(/\?$/, '') : `Stage ${i + 1}`
      const short = s.short?.trim() && !idLike(s.short) ? s.short : title.split(' ').slice(0, 3).join(' ')
      return { ...s, title, short }
    }),
  }
}

/** System names as readers see them: the owner's "[confirm]" note is dropped. */
export const sysLabel = (x: string) => x.replace(/\[confirm\]\s*/i, '').trim()
export const sysUnsure = (x: string) => /\[confirm\]/i.test(x)
