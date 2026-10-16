import { ROLE_COLORS, STAGE_COLORS, uid, type Process, type StepKind } from '@/lib/types'

/** Small, safe edit operations the AI may propose. Applied only after the user clicks Apply. */
export type Op =
  | { op: 'add_role'; name: string }
  | { op: 'rename_role'; role: string; name: string }
  | { op: 'add_stage'; title: string; short?: string; place?: string; text?: string; systems?: string[]; docs?: string[] }
  | { op: 'update_stage'; stage: string; title?: string; short?: string; place?: string; text?: string; systems?: string[]; docs?: string[] }
  | { op: 'add_step'; id?: string; label: string; role: string; stage: string; kind?: StepKind; after?: string }
  | { op: 'update_step'; step: string; label?: string; role?: string; stage?: string }
  | { op: 'remove_step'; step: string }
  | { op: 'connect'; from: string; to: string; label?: string }
  | { op: 'disconnect'; from: string; to: string }
  | { op: 'set_meta'; title?: string; summary?: string; nutshell?: string; audience?: string; triggers?: string[]; outcomes?: string[] }

const norm = (s: string) => s.trim().toLowerCase()

export function applyOps(src: Process, ops: Op[]): { next: Process; added: Set<string>; notes: string[] } {
  const p: Process = structuredClone(src)
  const added = new Set<string>()
  const notes: string[] = []
  const findRole = (r: string) => p.roles.find((x) => x.id === r || norm(x.name) === norm(r))
  const findStage = (s: string) => p.stages.find((x) => x.id === s || norm(x.short) === norm(s) || norm(x.title) === norm(s)) ?? p.stages[Number(s) - 1]
  const findStep = (s: string) => p.steps.find((x) => x.id === s || norm(x.label) === norm(s))
  const ensureRole = (r: string) => {
    let role = findRole(r)
    if (!role && r) { role = { id: uid('r'), name: r, color: ROLE_COLORS[p.roles.length % ROLE_COLORS.length] }; p.roles.push(role); notes.push(`+ role ${r}`) }
    return role
  }

  for (const o of ops) {
    try {
      switch (o.op) {
        case 'add_role': if (!findRole(o.name)) ensureRole(o.name); break
        case 'rename_role': { const r = findRole(o.role); if (r) { r.name = o.name; notes.push(`~ role ${o.name}`) } break }
        case 'add_stage': {
          const id = uid('s')
          p.stages.push({ id, title: o.title, short: o.short || o.title.split(' ').slice(0, 3).join(' '), place: o.place || '', text: o.text || '', color: STAGE_COLORS[p.stages.length % STAGE_COLORS.length], systems: o.systems ?? [], docs: o.docs ?? [], roleIds: [], scene: 'auto' })
          notes.push(`+ stage ${o.short || o.title}`); break
        }
        case 'update_stage': {
          const s = findStage(o.stage); if (!s) break
          if (o.title) s.title = o.title; if (o.short) s.short = o.short; if (o.place) s.place = o.place; if (o.text) s.text = o.text
          if (o.systems) s.systems = o.systems; if (o.docs) s.docs = o.docs
          notes.push(`~ stage ${s.short}`); break
        }
        case 'add_step': {
          const role = ensureRole(o.role); const stage = findStage(o.stage)
          if (!role || !stage) break
          const id = o.id && !findStep(o.id) ? o.id : uid('st')
          p.steps.push({ id, kind: o.kind ?? 'step', label: o.label, roleId: role.id, stageId: stage.id })
          added.add(id)
          const after = o.after ? findStep(o.after) : undefined
          if (after) {
            p.edges.filter((e) => e.from === after.id).forEach((e) => { e.from = id })
            p.edges.push({ id: uid('e'), from: after.id, to: id })
          }
          notes.push(`+ step “${o.label}”`); break
        }
        case 'update_step': {
          const s = findStep(o.step); if (!s) break
          if (o.label) s.label = o.label
          if (o.role) { const r = ensureRole(o.role); if (r) s.roleId = r.id }
          if (o.stage) { const st = findStage(o.stage); if (st) s.stageId = st.id }
          notes.push(`~ step “${s.label}”`); break
        }
        case 'remove_step': {
          const s = findStep(o.step); if (!s) break
          const ins = p.edges.filter((e) => e.to === s.id), outs = p.edges.filter((e) => e.from === s.id)
          p.edges = p.edges.filter((e) => e.from !== s.id && e.to !== s.id)
          ins.forEach((a) => outs.forEach((b) => p.edges.push({ id: uid('e'), from: a.from, to: b.to, label: a.label })))
          p.steps = p.steps.filter((x) => x.id !== s.id)
          notes.push(`− step “${s.label}”`); break
        }
        case 'connect': {
          const a = findStep(o.from), b = findStep(o.to)
          if (a && b && !p.edges.some((e) => e.from === a.id && e.to === b.id)) { p.edges.push({ id: uid('e'), from: a.id, to: b.id, label: o.label }); notes.push(`+ link ${a.label} → ${b.label}`) }
          break
        }
        case 'disconnect': {
          const a = findStep(o.from), b = findStep(o.to)
          if (a && b) { p.edges = p.edges.filter((e) => !(e.from === a.id && e.to === b.id)); notes.push(`− link ${a.label} → ${b.label}`) }
          break
        }
        case 'set_meta': {
          if (o.title) p.title = o.title; if (o.summary) p.summary = o.summary; if (o.nutshell) p.nutshell = o.nutshell
          if (o.audience) p.audience = o.audience; if (o.triggers) p.triggers = o.triggers; if (o.outcomes) p.outcomes = o.outcomes
          notes.push('~ process details'); break
        }
      }
    } catch { /* ignore a malformed op, keep the rest */ }
  }
  return { next: p, added, notes }
}

export const summariseNotes = (notes: string[]) => {
  const c = (sym: string, word: string) => { const n = notes.filter((x) => x.startsWith(sym) && x.includes(word)).length; return n ? `${sym === '+' ? '+' : sym === '−' ? '−' : '~'}${n} ${word}${n > 1 ? 's' : ''}` : '' }
  return ['stage', 'role', 'step', 'link'].flatMap((w) => [c('+', w), c('~', w), c('−', w)]).filter(Boolean).join(' · ') || (notes.length ? 'Process details updated' : 'No changes')
}
