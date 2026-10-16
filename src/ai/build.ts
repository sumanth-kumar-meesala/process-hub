import { ROLE_COLORS, STAGE_COLORS, uid, type LibraryItem, type Process, type ResourceCategory, type Step, type Edge } from '@/lib/types'
import { autoAssign } from '@/lib/resources'

/**
 * "Build a whole process" mode.
 * Instead of a long list of edit operations (which models tend to cut short), the AI fills in
 * ONE nested outline: stages, each with its steps. The app turns that into roles, lanes,
 * steps, connections, a start and an end — so the result is always complete and connected.
 */
export interface BuildSpec {
  title?: string
  summary?: string
  nutshell?: string
  audience?: string
  triggers?: string[]
  outcomes?: string[]
  policies?: string[]
  related?: string[]
  new_resources?: { title: string; category?: string }[]
  edge_cases?: { case?: string; handled?: string }[]
  roles?: { name: string; does?: string; type?: string; tools?: string[] }[] | string[]
  stages?: {
    title?: string; short?: string; place?: string; text?: string
    systems?: string[]; docs?: string[]
    steps?: { label?: string; role?: string; kind?: string; no?: string; uses?: string[] }[]
  }[]
}

export const BUILD_SYSTEM = `You design business processes for "Process Hub", explained to non-technical staff in plain, friendly English (no jargon like BPMN, swimlane, gateway).
The user describes a process. Design the COMPLETE, DETAILED end-to-end process a real organisation would follow — include the preparation before, the checks during, and the follow-up after, not only the steps they mentioned.
Reply ONLY with JSON in exactly this shape:
{"reply":"<one or two friendly sentences saying what you built>",
 "process":{
  "title":"<short name>",
  "summary":"<one sentence>",
  "nutshell":"<2-3 plain sentences: who does what, start to finish>",
  "audience":"<who this is for>",
  "triggers":["<what starts it>", "..."],
  "outcomes":["<how you know it's done>", "..."],
  "policies":["<library ids of policies that apply to the whole process>"],
  "related":["<library ids of related processes>"],
  "new_resources":[{"title":"<a form, document, guide or policy the process needs that is NOT in the library>","category":"form|client-doc|guide|policy"}],
  "edge_cases":[{"case":"<what could go wrong or be different, plain words>","handled":"<exact label of the step or check that deals with it>"}],
  "roles":[{"name":"<role>","does":"<their part, a few words>","type":"person|agent"},
           {"name":"<AI agent name>","type":"agent","tools":["<tool, MCP server or API it uses>"]}],
  "stages":[
   {"title":"<what happens in this phase>","short":"<2-3 words>","place":"<where it happens>","text":"<one or two plain sentences>",
    "systems":["<app or tool used>"],"docs":["<form, record or template used>"],
    "steps":[
      {"label":"<verb first, max 6 words>","role":"<one of the roles>","uses":["<library id or new resource title>"]},
      {"label":"<a yes/no check ending with ?>","role":"<role>","kind":"decision","no":"<label of the earlier step to go back to if No>"}
    ]}
  ]}}
Requirements:
- 4 to 7 roles. When AI does work, make it a role with "type":"agent" and list the tools it uses in "tools" (e.g. "Transcription API", "Client record system (MCP)", "Email API").
- After an AI agent step, add a person check (decision) so a human reviews its work.
- 5 to 7 stages in time order. Each stage has 3 to 5 steps, every step done by one of the roles.
- At least 3 decisions (checks, consent, approval, quality review), EACH with a "no" path that goes somewhere sensible (fix and re-check, ask for missing info, escalate).
- EDGE CASES: think like an experienced process owner about what really goes wrong, and build steps/checks for them. Consider and include the ones that apply:
  missing or wrong information · request rejected or not approved · nobody responds in time (reminder, then escalate to a named role) · the person/client says no or withdraws consent ·
  AI agent fails, is unsure or gets it wrong (a person takes over) · urgent or high-risk case (faster path / who to tell) · cancelled or changed part-way · a system is down (manual fallback) ·
  privacy breach or incident (link to incident process) · records not completed (follow-up before close).
  List 5-8 of them in "edge_cases", each pointing to the step or check that handles it. Every edge case must be handled by a real step in "stages".
- SYSTEMS: the organisation's INTERNAL SYSTEMS are listed. Put the exact system name in a stage's "systems" whenever a step there uses it. If a step needs a system nobody named, write "[confirm] <generic name>" so the owner can check.
- Use the OWNER'S ANSWERS when given — they override your assumptions.
- Do not include start or end steps — the app adds them from triggers and outcomes.
- RESOURCES: a LIBRARY of existing forms, client documents, how-to guides, policies and related processes is given (id|category|title). For each step, put in "uses" the ids of the library items that step needs (0-3). Prefer library items. Only if something important is missing, add it to "new_resources" and use its exact title in "uses".`

export const MIN_DECISIONS = 3
export const MIN_EDGE_CASES = 4

/** What the draft still misses: thin checks, checks with no "no" path, AI steps nobody reviews, too few edge cases. */
export function edgeGaps(s?: BuildSpec): string[] {
  if (!s?.stages?.length) return []
  const steps = s.stages.flatMap((st) => st.steps ?? [])
  const isDec = (x: { kind?: string; label?: string }) => x.kind === 'decision' || /\?\s*$/.test(x.label ?? '')
  const decs = steps.filter(isDec)
  const gaps: string[] = []
  if (decs.length < MIN_DECISIONS) gaps.push(`only ${decs.length} checks — add at least ${MIN_DECISIONS}, each with a "no" path`)
  const noPath = decs.filter((d) => !d.no).map((d) => `"${d.label}"`)
  if (noPath.length) gaps.push(`these checks have no "no" path: ${noPath.join(', ')}`)
  const agents = new Set((s.roles ?? []).filter((r) => typeof r !== 'string' && (r.type === 'agent' || r.tools?.length)).map((r) => (r as { name: string }).name.toLowerCase()))
  steps.forEach((x, i) => {
    if (x.role && agents.has(x.role.toLowerCase()) && !isDec(x)) {
      const nextOne = steps[i + 1]
      if (!nextOne || !(isDec(nextOne) && !agents.has((nextOne.role ?? '').toLowerCase()))) gaps.push(`AI step "${x.label}" has no person checking it straight after`)
    }
  })
  const ec = (s.edge_cases ?? []).filter((e) => e?.case)
  if (ec.length < MIN_EDGE_CASES) gaps.push(`only ${ec.length} edge cases listed — list ${MIN_EDGE_CASES}-8 (no response in time, rejected, missing info, consent withdrawn, AI unsure, system down, urgent case)`)
  const labels = new Set(steps.map((x) => (x.label ?? '').toLowerCase().trim()))
  const orphan = ec.filter((e) => e.handled && !labels.has(e.handled.toLowerCase().trim())).map((e) => `"${e.case}"`)
  if (orphan.length > 2) gaps.push(`these edge cases don't point to a real step label: ${orphan.slice(0, 4).join(', ')}`)
  return gaps.slice(0, 6)
}

export const MIN_STAGES = 4
export const MIN_STEPS = 10

export const specStats = (s?: BuildSpec) => {
  const stages = s?.stages?.length ?? 0
  const steps = s?.stages?.reduce((a, st) => a + (st.steps?.length ?? 0), 0) ?? 0
  return { stages, steps, ok: stages >= MIN_STAGES && steps >= MIN_STEPS }
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

/** Turn the AI's outline into a full process, keeping the original's id, owner, code, area and status. */
export function specToProcess(base: Process, spec: BuildSpec, lib: LibraryItem[] = []): { next: Process; added: Set<string>; notes: string[]; newItems: LibraryItem[] } {
  // library items the AI asked for that don't exist yet
  const CATS: ResourceCategory[] = ['form', 'client-doc', 'guide', 'policy', 'process']
  const newItems: LibraryItem[] = (spec.new_resources ?? []).filter((r) => r?.title && !lib.some((x) => norm(x.title) === norm(r.title)))
    .map((r) => ({ id: uid('lib'), title: r.title.trim(), category: (CATS.includes(r.category as ResourceCategory) ? r.category : 'form') as ResourceCategory, isNew: true }))
  const all = [...lib, ...newItems]
  const resolve = (ref: string) => all.find((x) => x.id === ref || norm(x.title) === norm(ref))?.id

  const roleNames = (spec.roles ?? []).map((r) => (typeof r === 'string' ? r : r.name)).filter(Boolean) as string[]
  const roles: Process['roles'] = []
  const roleId = (name?: string) => {
    const n = (name || roleNames[0] || 'Team').trim()
    let r = roles.find((x) => norm(x.name) === norm(n))
    if (!r) { r = { id: uid('r'), name: n, color: ROLE_COLORS[roles.length % ROLE_COLORS.length] }; roles.push(r) }
    return r.id
  }
  roleNames.forEach((n) => roleId(n))
  ;(spec.roles ?? []).forEach((r) => {
    if (typeof r === 'string') return
    const role = roles.find((x) => norm(x.name) === norm(r.name))
    if (!role) return
    if (r.type === 'agent' || r.type === 'person' || r.type === 'team' || r.type === 'system') role.kind = r.type
    if (r.tools?.length) { role.tools = r.tools.filter(Boolean).slice(0, 6); role.kind = role.kind ?? 'agent' }
  })

  const stages: Process['stages'] = []
  const steps: Step[] = []
  const edges: Edge[] = []
  const pendingNo: { from: string; target: string; fallback: string }[] = []
  let prev: string | null = null
  const link = (from: string, to: string, label?: string) => edges.push({ id: uid('e'), from, to, label })

  ;(spec.stages ?? []).forEach((st, i) => {
    const sid = uid('s')
    const title = st.title || st.short || `Stage ${i + 1}`
    stages.push({
      id: sid, title, short: st.short || title.split(' ').slice(0, 3).join(' '), place: st.place || '', text: st.text || '',
      color: STAGE_COLORS[i % STAGE_COLORS.length], systems: (st.systems ?? []).filter(Boolean), docs: (st.docs ?? []).filter(Boolean), roleIds: [], scene: 'auto',
    })
    ;(st.steps ?? []).forEach((x, j) => {
      if (!x.label) return
      const kind = x.kind === 'decision' || /\?$/.test(x.label.trim()) ? 'decision' : 'step'
      const id = uid('st')
      if (i === 0 && j === 0) {
        const start: Step = { id: uid('st'), kind: 'start', label: spec.triggers?.[0] || 'It starts', roleId: roleId(x.role), stageId: sid }
        steps.push(start); prev = start.id
      }
      const resourceIds = [...new Set((x.uses ?? []).map(resolve).filter(Boolean) as string[])]
      steps.push({ id, kind, label: x.label.trim(), roleId: roleId(x.role), stageId: sid, ...(resourceIds.length ? { resourceIds } : {}) })
      if (prev) link(prev, id, steps.find((s) => s.id === prev)?.kind === 'decision' ? 'Yes' : undefined)
      if (kind === 'decision') pendingNo.push({ from: id, target: x.no || '', fallback: prev ?? id })
      prev = id
    })
  })

  // finish: one end step after the last one
  if (prev && stages.length) {
    const lastStep = steps.find((s) => s.id === prev)!
    const end: Step = { id: uid('st'), kind: 'end', label: spec.outcomes?.[0] || "It's done", roleId: lastStep.roleId, stageId: stages[stages.length - 1].id }
    steps.push(end); link(prev, end.id, lastStep.kind === 'decision' ? 'Yes' : undefined)
  }
  // "No" paths go back to the named step (or the step just before the check)
  pendingNo.forEach(({ from, target, fallback }) => {
    const t = target && steps.find((s) => s.id !== from && s.kind !== 'start' && (norm(s.label) === norm(target) || norm(s.label).includes(norm(target)) || norm(target).includes(norm(s.label))))
    const to = t ? t.id : fallback
    if (to !== from) link(from, to, 'No')
  })

  const linkedIds = [...new Set([...(spec.policies ?? []), ...(spec.related ?? [])].map(resolve).filter(Boolean) as string[])]
  const built: Process = {
    ...base,
    linkedIds: linkedIds.length ? linkedIds : undefined,
    resources: [],
    title: spec.title || base.title,
    summary: spec.summary || base.summary,
    nutshell: spec.nutshell || base.nutshell,
    audience: spec.audience || base.audience,
    triggers: spec.triggers?.length ? spec.triggers : base.triggers,
    outcomes: spec.outcomes?.length ? spec.outcomes : base.outcomes,
    roles, stages, steps, edges, layout: {},
    exceptions: (spec.edge_cases ?? []).filter((e) => e?.case).map((e) => ({ case: e.case!.trim(), handled: (e.handled ?? '').trim() })).slice(0, 10),
    needsCompleting: false,
  }
  // if the AI linked resources itself, trust it; otherwise match steps from the library automatically
  const workSteps = steps.filter((s) => s.kind === 'step' || s.kind === 'decision')
  const aiLinked = workSteps.filter((s) => s.resourceIds?.length).length
  const next = aiLinked >= Math.max(2, workSteps.length * 0.3) ? built : autoAssign(built, all)
  const work = steps.filter((s) => s.kind === 'step' || s.kind === 'decision').length
  const notes = [
    ...stages.map((s) => `+ stage ${s.short}`), ...roles.map((r) => `+ role ${r.name}`),
    ...steps.filter((s) => s.kind === 'step' || s.kind === 'decision').map((s) => `+ step “${s.label}”`),
    ...edges.map(() => '+ link'),
  ]
  void work
  const linkedCount = next.steps.reduce((a, s) => a + (s.resourceIds?.length ?? 0), 0)
  if (linkedCount) notes.push(`~ ${linkedCount} resource links`)
  newItems.forEach((it) => notes.push(`+ new library item “${it.title}”`))
  return { next, added: new Set(steps.map((s) => s.id)), notes, newItems }
}
