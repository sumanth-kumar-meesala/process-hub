import type { LibraryItem, Process, ResourceCategory, Step } from './types'

export const CATEGORIES: { id: ResourceCategory; title: string; note: string; color: string; one: string }[] = [
  { id: 'form', title: 'Forms & templates', note: 'To fill in', color: '#2563EB', one: 'Form or template' },
  { id: 'client-doc', title: 'Client documents', note: 'Kept in client records', color: '#DB2777', one: 'Client document' },
  { id: 'guide', title: 'How-to guides', note: 'Step-by-step for systems', color: '#16A34A', one: 'How-to guide' },
  { id: 'policy', title: 'Policies', note: 'The rules behind it', color: '#EA580C', one: 'Policy' },
  { id: 'process', title: 'Related processes', note: 'Linked work', color: '#7C3AED', one: 'Related process' },
]
export const catOf = (c: ResourceCategory) => CATEGORIES.find((x) => x.id === c) ?? CATEGORIES[0]

/* ---------- keyword matching (no AI needed) ---------- */
const STOP = new Set('a an the and or of to for in on at by with from is are be it this that their them they your you our we as if then into out up down not no yes do does done each per via its'.split(' '))
// words that mean the same thing for matching purposes
const SYN: [RegExp, string][] = [
  [/^(train|training|trained|course|learn|learning|lms|totara)$/, 'train'],
  [/^(approv|approve|approved|approval|authoris|authorise|sign|signoff)$/, 'approve'],
  [/^(book|booking|schedul|schedule|scheduled|calendar|invite|meeting|arrang|arrange)$/, 'schedule'],
  [/^(record|records|recorded|recording|log|file|filed|store|update)$/, 'record'],
  [/^(evidenc|evidence|proof|checklist)$/, 'evidence'],
  [/^(complian|compliance|compliant|standard|standards|ndis|regulat)$/, 'compliance'],
  [/^(plan|plans|pathway|psp)$/, 'plan'],
  [/^(client|clients|participant|customer)$/, 'client'],
  [/^(assess|assessment|competency|competent|skill|skills|capab)$/, 'assess'],
  [/^(need|needs|requirement|requirements|identify|work)$/, 'need'],
  [/^(monitor|monitoring|review|reviews|audit|check)$/, 'monitor'],
  [/^(deliver|delivery|run|session|sessions)$/, 'session'],
  [/^(incident|incidents|risk)$/, 'incident'],
  [/^(consent|privacy|confidential)$/, 'consent'],
]
const stem = (w: string) => w.replace(/(ings|ing|ed|ies|es|s)$/, '')
const norm = (w: string) => {
  const s = stem(w)
  for (const [re, to] of SYN) if (re.test(w) || re.test(s)) return to
  return s
}
export const words = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(norm))

// very common words: they help a match but can't make one on their own
const GENERIC = new Set(['record', 'client', 'train', 'form', 'session', 'document', 'template', 'policy', 'guide', 'process'])

const itemWords = (it: LibraryItem) => words(`${it.title} ${(it.tags ?? []).join(' ')}`)

/** Context words for a step: its label, its stage, the role and the stage's systems. */
function stepContext(p: Process, s: Step) {
  const st = p.stages.find((x) => x.id === s.stageId)
  const role = p.roles.find((r) => r.id === s.roleId)
  return {
    main: words(s.label),
    around: words(`${st?.title ?? ''} ${st?.short ?? ''} ${st?.text ?? ''} ${role?.name ?? ''}`),
    systems: words((st?.systems ?? []).join(' ')),
  }
}

export function scoreItem(p: Process, s: Step, it: LibraryItem) {
  if (it.category === 'process') return 0 // related processes are linked at process level
  const iw = itemWords(it)
  const { main, around, systems } = stepContext(p, s)
  let score = 0, mainHits = 0
  iw.forEach((w) => {
    const g = GENERIC.has(w)
    if (main.has(w)) { score += g ? 1 : 2; if (!g) mainHits++ } else if (around.has(w)) score += g ? 0.3 : 0.6
    if (systems.has(w)) score += 1
  })
  if (s.kind === 'decision' && it.category === 'policy') score += 0.5
  // only the step's surroundings matched → probably too generic
  if (!mainHits) score *= 0.45
  // an item whose words are mostly found in the step is a strong match
  if (mainHits >= 2 || (iw.size && mainHits / iw.size > 0.3)) score += 1
  return score
}

/** Best library items for one step (max 3, only confident matches). */
export function suggestFor(p: Process, s: Step, lib: LibraryItem[], max = 3) {
  if (s.kind === 'start' || s.kind === 'end') return []
  const ranked = lib.map((it) => ({ it, sc: scoreItem(p, s, it) })).filter((x) => x.sc >= 2.5).sort((a, b) => b.sc - a.sc)
  const top = ranked[0]?.sc ?? 0
  // keep only items close to the best match, so weaker "also mentions training" items drop out
  return ranked.filter((x) => x.sc >= top * 0.7).slice(0, max).map((x) => x.it)
}

/** Process-wide policies and related processes. */
export function suggestLinked(p: Process, lib: LibraryItem[], allProcesses: Process[] = []) {
  const ctx = words(`${p.title} ${p.summary} ${p.triggers.join(' ')} ${p.stages.map((s) => s.title).join(' ')}`)
  const pick = (cat: ResourceCategory, min: number, max: number) => lib.filter((it) => it.category === cat)
    .map((it) => { const iw = itemWords(it); let sc = 0; iw.forEach((w) => { if (ctx.has(w)) sc++ }); return { it, sc } })
    .filter((x) => x.sc >= min).sort((a, b) => b.sc - a.sc).slice(0, max).map((x) => x.it)
  const related = pick('process', 1, 3).filter((it) => !it.processId || it.processId !== p.id)
  // processes that already exist in the hub can be linked too
  const hub = allProcesses.filter((o) => o.id !== p.id && o.status === 'published')
    .filter((o) => { const ow = words(o.title); let n = 0; ow.forEach((w) => { if (ctx.has(w)) n++ }); return n >= 2 })
  return { policies: pick('policy', 2, 3), related, hub }
}

/** Fill in resources for steps that have none yet and that a person hasn't edited. */
export function autoAssign(p: Process, lib: LibraryItem[], allProcesses: Process[] = []): Process {
  const steps = p.steps.map((s) => {
    if (s.resourcesTouched || s.kind === 'start' || s.kind === 'end' || s.resourceIds?.length) return s
    const have = new Set<string>()
    suggestFor(p, s, lib).forEach((it) => have.add(it.id))
    return { ...s, resourceIds: [...have] }
  })
  if (p.linkedIds?.length) return { ...p, steps }
  const { policies, related } = suggestLinked(p, lib, allProcesses)
  return { ...p, steps, linkedIds: [...policies, ...related].map((it) => it.id) }
}

/** Every library item a process uses, grouped by category, with the steps that use it. */
export function processResources(p: Process, lib: LibraryItem[]) {
  const byId = new Map(lib.map((it) => [it.id, it]))
  const uses = new Map<string, string[]>()
  p.steps.forEach((s) => (s.resourceIds ?? []).forEach((id) => uses.set(id, [...(uses.get(id) ?? []), s.label])))
  ;(p.linkedIds ?? []).forEach((id) => { if (!uses.has(id)) uses.set(id, []) })
  const items = [...uses.keys()].map((id) => byId.get(id)).filter(Boolean) as LibraryItem[]
  return CATEGORIES.map((c) => ({ ...c, items: items.filter((it) => it.category === c.id).map((it) => ({ it, usedBy: uses.get(it.id) ?? [] })) })).filter((g) => g.items.length)
}

export const stageResources = (p: Process, stageId: string, lib: LibraryItem[]) => {
  const ids = new Set(p.steps.filter((s) => s.stageId === stageId).flatMap((s) => s.resourceIds ?? []))
  return lib.filter((it) => ids.has(it.id))
}

export const stepResources = (s: Step, lib: LibraryItem[]) => (s.resourceIds ?? []).map((id) => lib.find((it) => it.id === id)).filter(Boolean) as LibraryItem[]

/** Compact list for the AI prompt: id|category|title */
export const libraryOutline = (lib: LibraryItem[]) => lib.map((it) => `${it.id}|${it.category}|${it.title}`).join('\n')
