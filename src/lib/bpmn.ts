import { ROLE_COLORS, STAGE_COLORS, type Edge, type LibraryItem, type Process, type ResourceCategory, type Role, type Stage, type Step } from './types'

/**
 * Turns a BPMN 2.0 file (as exported from SAP Signavio, or any BPMN tool) into a Process Hub process.
 *
 *   pools / lanes          → roles
 *   tasks, call activities → steps
 *   exclusive / inclusive / event-based gateways that split → checks (decisions), with Yes / No paths
 *   start / end events     → start and finish (and the process's triggers and outcomes)
 *   sequence & message flows → links
 *   boundary events (timer, error, escalation…) → extra links + "What if…?" cases
 *   data stores / IT systems → systems,  data objects → documents,  documentation & annotations → step notes
 *   groups (or expanded sub-processes) → stages; without them the steps are split into stages automatically
 *
 * Merging gateways, parallel gateways and unnamed events are only routing, so they are removed and their links joined up.
 */

export interface BpmnSource {
  /** file name, e.g. "Purchase to Pay.bpmn" */
  file: string
  /** where it came from: a SharePoint server-relative path, or "local" */
  path?: string
  /** last modified time of the file, used to skip unchanged files */
  modified?: string
  /** the sub-folder it sits in (used as the process's area) */
  folder?: string
}

export interface BpmnResult {
  process: Process
  /** documents linked in Signavio, to add to the resource library */
  library: LibraryItem[]
  warnings: string[]
}

const TASKS = new Set(['task', 'userTask', 'manualTask', 'serviceTask', 'scriptTask', 'sendTask', 'receiveTask', 'businessRuleTask', 'callActivity'])
const SUBS = new Set(['subProcess', 'adHocSubProcess', 'transaction'])
const GATEWAYS = new Set(['exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway', 'complexGateway'])
const CHOICE_GATEWAYS = new Set(['exclusiveGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'])
const MID_EVENTS = new Set(['intermediateCatchEvent', 'intermediateThrowEvent'])

type Kind = 'step' | 'decision' | 'start' | 'end' | 'pass'
interface Node { id: string; el: Element; type: string; name: string; kind: Kind; roleId: string; sub?: string; box?: Box }
interface Link { from: string; to: string; label?: string; prio: number }
interface Box { x: number; y: number; w: number; h: number }

const clean = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim()
const BULLET = /^([-*•·–]|\d+[.)])\s+/
/**
 * A shape's text as one line. Wrapped lines are joined with a space; separate paragraphs and bullet lists
 * (Signavio events often list linked processes: "- FS43 Create Client Details / - FS08, Manage Plan Review")
 * become "FS43 Create Client Details · FS08, Manage Plan Review".
 */
const textOf = (s?: string | null) => (s ?? '').split(/\r?\n\s*\r?\n/)
  .flatMap((para) => {
    const lines = para.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    return lines.some((l) => BULLET.test(l)) ? lines.map((l) => l.replace(BULLET, '')) : [lines.join(' ')]
  })
  .map(clean).filter(Boolean).join(' · ')
const kids = (el: Element, name?: string) => Array.from(el.children).filter((c) => !name || c.localName === name)
const all = (doc: Document | Element, name: string) => Array.from(doc.getElementsByTagNameNS('*', name))
const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
const inside = (p: { x: number; y: number }, b: Box) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'process'
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }

const POS = /^(yes|y|ja|si|oui|ok|okay|approved?|accept(ed)?|true|valid|complete(d)?|pass(ed)?|correct|agreed?|available|sufficient|found|granted|in order|fine)\b/i
const NEG = /^(no|n|nein|non|not\b|rejected?|declined?|denied|deny|false|invalid|incomplete|fail(ed)?|incorrect|missing|insufficient|unavailable|none|nok)\b/i

const EVENT_WORDS: Record<string, string> = {
  timerEventDefinition: 'If it takes too long', errorEventDefinition: 'If something goes wrong', escalationEventDefinition: 'If it is escalated',
  messageEventDefinition: 'If a message comes in', signalEventDefinition: 'If a signal comes in', conditionalEventDefinition: 'If the condition is met',
  compensateEventDefinition: 'If it has to be undone', cancelEventDefinition: 'If it is cancelled',
}
const eventWords = (el: Element) => {
  const def = kids(el).find((c) => c.localName.endsWith('EventDefinition'))
  return (def && EVENT_WORDS[def.localName]) || 'If something unusual happens'
}

/** Signavio keeps extra attributes as <signavio:signavioMetaData metaKey="…" metaValue="…"/>. */
const meta = (el: Element) => all(el, 'signavioMetaData')
  .filter((m) => m.parentElement?.parentElement === el)
  .map((m) => ({ key: m.getAttribute('metaKey') ?? '', value: m.getAttribute('metaValue') ?? '' }))

/** Text of an element's own <documentation>. */
const docText = (el: Element) => kids(el, 'documentation').map((d) => (d.textContent ?? '').trim()).filter(Boolean).join('\n')

/** Pulls document links out of Signavio metadata (external documents, links, attachments). */
function metaLinks(el: Element): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = []
  for (const { key, value } of meta(el)) {
    if (!/https?:\/\//i.test(value)) continue
    let parsed: unknown
    try { parsed = JSON.parse(value) } catch { parsed = undefined }
    const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed] : []
    let found = false
    for (const it of items as Record<string, unknown>[]) {
      const url = String(it.url ?? it.href ?? it.link ?? '')
      if (!/^https?:\/\//i.test(url)) continue
      out.push({ title: clean(String(it.name ?? it.title ?? it.label ?? '')) || url.split('/').pop() || key, url }); found = true
    }
    if (!found) for (const url of value.match(/https?:\/\/[^\s"'<>,;]+/g) ?? []) out.push({ title: decodeURIComponent(url.split('/').pop() || key).replace(/\.\w+$/, ''), url })
  }
  return out
}

const categoryFor = (title: string): ResourceCategory =>
  /polic|procedure|standard|regulation|guideline/i.test(title) ? 'policy'
    : /form|template|checklist|request/i.test(title) ? 'form'
      : 'guide'

/** Reads a BPMN file and returns the process, or throws an Error with a plain-words reason. */
export function bpmnToProcess(xml: string, src: BpmnSource): BpmnResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not valid XML.')
  const defs = doc.documentElement
  if (defs.localName !== 'definitions') throw new Error('This is not a BPMN 2.0 file (no <definitions>).')
  const warnings: string[] = []

  // ---------- diagram positions ----------
  const boxes = new Map<string, Box>()
  for (const sh of all(doc, 'BPMNShape')) {
    const id = sh.getAttribute('bpmnElement'), b = kids(sh, 'Bounds')[0]
    if (!id || !b || boxes.has(id)) continue
    boxes.set(id, { x: +(b.getAttribute('x') ?? 0), y: +(b.getAttribute('y') ?? 0), w: +(b.getAttribute('width') ?? 0), h: +(b.getAttribute('height') ?? 0) })
  }

  // ---------- roles: pools and lanes ----------
  const participants = all(defs, 'participant')
  const procs = kids(defs, 'process')
  if (!procs.length) throw new Error('The file has no process in it.')
  const roles: Role[] = []
  const roleByName = new Map<string, Role>()
  const roleFor = (name: string) => {
    const key = name.toLowerCase()
    let r = roleByName.get(key)
    if (!r) { r = { id: `r${roles.length + 1}`, name, color: ROLE_COLORS[roles.length % ROLE_COLORS.length] }; roles.push(r); roleByName.set(key, r) }
    return r
  }
  const roleOfNode = new Map<string, string>()
  const laneBoxes: { box: Box; roleId: string }[] = []
  const procDefaultRole = new Map<string, string>()

  for (const proc of procs) {
    const pool = participants.find((p) => p.getAttribute('processRef') === proc.getAttribute('id'))
    const poolName = clean(pool?.getAttribute('name')) || clean(proc.getAttribute('name'))
    const leaves: Element[] = []
    const walkLanes = (laneSet: Element) => kids(laneSet, 'lane').forEach((lane) => {
      const child = kids(lane, 'childLaneSet')[0]
      if (child && kids(child, 'lane').length) walkLanes(child); else leaves.push(lane)
    })
    // lanes of the process, and of expanded sub-processes inside it (they can have lanes of their own)
    all(proc, 'laneSet').forEach(walkLanes)
    if (leaves.length) {
      leaves.forEach((lane) => {
        const r = roleFor(clean(lane.getAttribute('name')) || poolName || 'Team')
        kids(lane, 'flowNodeRef').forEach((ref) => roleOfNode.set(clean(ref.textContent), r.id))
        const b = boxes.get(lane.getAttribute('id') ?? '')
        if (b) laneBoxes.push({ box: b, roleId: r.id })
      })
      procDefaultRole.set(proc.getAttribute('id') ?? '', roleFor(clean(leaves[0].getAttribute('name')) || poolName || 'Team').id)
    } else {
      procDefaultRole.set(proc.getAttribute('id') ?? '', roleFor(poolName || 'Team').id)
    }
  }

  // ---------- nodes ----------
  const nodes = new Map<string, Node>()
  const subs: Node[] = []          // expanded sub-processes
  const boundaries: Element[] = []
  const flows: Element[] = []
  const walk = (container: Element, procId: string, sub?: Node) => {
    for (const el of kids(container)) {
      const t = el.localName, id = el.getAttribute('id') ?? ''
      if (t === 'sequenceFlow') { flows.push(el); continue }
      if (t === 'boundaryEvent') { boundaries.push(el); continue }
      const isTask = TASKS.has(t), isSub = SUBS.has(t), isGw = GATEWAYS.has(t)
      const isEvent = t === 'startEvent' || t === 'endEvent' || MID_EVENTS.has(t)
      if (!isTask && !isSub && !isGw && !isEvent) continue
      const name = textOf(el.getAttribute('name'))
      let kind: Kind = 'step'
      if (t === 'startEvent') kind = sub ? 'pass' : 'start'
      else if (t === 'endEvent') kind = sub ? 'pass' : 'end'
      else if (MID_EVENTS.has(t)) kind = name && !kids(el).some((c) => c.localName === 'linkEventDefinition') ? 'step' : 'pass'
      else if (isGw) kind = 'pass' // decided below, once links are known
      const box = boxes.get(id)
      let roleId = roleOfNode.get(id) ?? sub?.roleId
      if (!roleId && box) roleId = laneBoxes.find((l) => inside(centre(box), l.box))?.roleId
      const node: Node = { id, el, type: t, name, kind, roleId: roleId ?? procDefaultRole.get(procId) ?? roles[0]?.id ?? 'r1', sub: sub?.id, box }
      nodes.set(id, node)
      if (isSub) {
        const inner = kids(el).some((c) => TASKS.has(c.localName) || SUBS.has(c.localName) || GATEWAYS.has(c.localName) || c.localName.endsWith('Event'))
        if (inner) { node.kind = 'pass'; subs.push(node); walk(el, procId, node) }
      }
    }
  }
  procs.forEach((p) => walk(p, p.getAttribute('id') ?? ''))
  if (!roles.length) roleFor('Team')

  // ---------- links ----------
  let links: Link[] = flows
    .map((f) => ({ from: f.getAttribute('sourceRef') ?? '', to: f.getAttribute('targetRef') ?? '', label: clean(f.getAttribute('name')) || undefined, prio: 0 }))
    .filter((l) => nodes.has(l.from) && nodes.has(l.to))

  // message flows between pools (after the normal links, so the usual path follows the sequence flow)
  for (const mf of all(defs, 'messageFlow')) {
    const from = mf.getAttribute('sourceRef') ?? '', to = mf.getAttribute('targetRef') ?? ''
    if (nodes.has(from) && nodes.has(to)) links.push({ from, to, label: clean(mf.getAttribute('name')) || undefined, prio: 1 })
  }

  // expanded sub-processes: in → its start, its end → out
  for (const s of subs) {
    const inner = [...nodes.values()].filter((n) => n.sub === s.id)
    const innerIds = new Set(inner.map((n) => n.id))
    let starts = inner.filter((n) => n.type === 'startEvent')
    if (!starts.length) starts = inner.filter((n) => !links.some((l) => l.to === n.id && innerIds.has(l.from)))
    let ends = inner.filter((n) => n.type === 'endEvent')
    if (!ends.length) ends = inner.filter((n) => !links.some((l) => l.from === n.id && innerIds.has(l.to)))
    const outs = links.filter((l) => l.from === s.id)
    links = links.filter((l) => l.from !== s.id)
    starts.forEach((st) => links.push({ from: s.id, to: st.id, prio: 0 }))
    ends.forEach((en) => outs.forEach((o) => links.push({ from: en.id, to: o.to, label: o.label, prio: o.prio })))
  }

  // boundary events: an extra way out of the step they sit on
  const exceptions: { on: string; what: string }[] = []
  for (const b of boundaries) {
    const on = b.getAttribute('attachedToRef') ?? ''
    if (!nodes.has(on)) continue
    const what = textOf(b.getAttribute('name')) || eventWords(b)
    const id = b.getAttribute('id') ?? ''
    // the boundary event becomes a routing-only node hanging off its step, so its path joins up below
    nodes.set(id, { id, el: b, type: 'boundaryEvent', name: what, kind: 'pass', roleId: nodes.get(on)!.roleId, sub: nodes.get(on)!.sub, box: boxes.get(id) })
    links.push({ from: on, to: id, label: what, prio: 2 })
    flows.filter((f) => f.getAttribute('sourceRef') === id).forEach((f) => links.push({ from: id, to: f.getAttribute('targetRef') ?? '', prio: 2 }))
    exceptions.push({ on, what })
  }
  links = links.filter((l) => nodes.has(l.from) && nodes.has(l.to))

  // parallel work ("do A and B, then carry on"): the app walks one path at a time, so simple parallel
  // branches that meet again are lined up one after the other — every branch is then part of the walk
  for (const p of [...nodes.values()].filter((n) => n.type === 'parallelGateway')) {
    const outs = links.filter((l) => l.from === p.id && l.prio === 0)
    if (outs.length < 2) continue
    let join: string | undefined, ok = true
    const branches: string[][] = []
    for (const o of outs) {
      const path: string[] = []
      let cur = o.to
      for (let i = 0; ok && i < 60; i++) {
        const n = nodes.get(cur)
        if (!n) { ok = false; break }
        if (n.type === 'parallelGateway') { if (join && join !== cur) ok = false; join = cur; break }
        if (GATEWAYS.has(n.type) || n.kind === 'end' || SUBS.has(n.type) && subs.includes(n)) { ok = false; break }
        path.push(cur)
        const next = links.filter((l) => l.from === cur && l.prio === 0)
        if (next.length !== 1) { ok = false; break }
        cur = next[0].to
      }
      if (!ok) break
      if (path.length) branches.push(path)
    }
    if (!ok || !join || branches.length < 2) continue
    const j = join
    for (let i = 0; i < branches.length - 1; i++) {
      const last = branches[i][branches[i].length - 1], nextFirst = branches[i + 1][0]
      links = links.filter((l) => !(l.from === last && l.to === j) && !(l.from === p.id && l.to === nextFirst))
      links.push({ from: last, to: nextFirst, prio: 0 })
    }
  }

  // a start that is triggered by a message from another pool, or an end that sends one, is only routing
  for (const n of nodes.values()) {
    if (n.kind === 'start' && links.some((l) => l.to === n.id)) n.kind = 'pass'
    if (n.kind === 'end' && links.some((l) => l.from === n.id)) n.kind = 'pass'
  }

  // gateways: a choice that splits is a check; everything else is routing
  for (const n of nodes.values()) {
    if (!GATEWAYS.has(n.type)) continue
    const outs = links.filter((l) => l.from === n.id && l.prio === 0)
    n.kind = CHOICE_GATEWAYS.has(n.type) && outs.length >= 2 ? 'decision' : 'pass'
  }

  // ---------- remove routing-only nodes, joining their links ----------
  for (let guard = 0; guard < 5000; guard++) {
    const p = [...nodes.values()].find((n) => n.kind === 'pass')
    if (!p) break
    const ins = links.filter((l) => l.to === p.id && l.from !== p.id)
    const outs = links.filter((l) => l.from === p.id && l.to !== p.id)
    links = links.filter((l) => l.from !== p.id && l.to !== p.id)
    for (const i of ins) for (const o of outs) {
      if (i.from === o.to) continue
      links.push({ from: i.from, to: o.to, label: i.label || o.label, prio: Math.max(i.prio, o.prio) })
    }
    nodes.delete(p.id)
  }
  // drop duplicates (keep the labelled one, lowest priority)
  const seen = new Map<string, Link>()
  for (const l of links.sort((a, b) => a.prio - b.prio)) {
    const k = `${l.from}>${l.to}`
    const had = seen.get(k)
    if (!had) seen.set(k, l)
    else if (!had.label && l.label) had.label = l.label
  }
  links = [...seen.values()]

  // another pool's work that a message sets off (and that doesn't branch) is woven into the path
  // straight after the step that sends the message, so "walk it with me" goes through it too
  for (const m of links.filter((l) => l.prio === 1)) {
    const mainOut = links.filter((l) => l.from === m.from && l.prio === 0)
    if (mainOut.length !== 1) continue
    const chain: string[] = []
    let cur = m.to, endId: string | undefined, ok = true
    for (let i = 0; i < 40; i++) {
      const n = nodes.get(cur)
      if (!n) { ok = false; break }
      if (n.kind === 'end') { endId = cur; break }
      const prev = chain.length ? chain[chain.length - 1] : m.from
      if (n.kind !== 'step' || chain.includes(cur) || links.some((l) => l.from === cur && l.prio === 1) || links.some((l) => l.to === cur && l.from !== prev)) { ok = false; break }
      chain.push(cur)
      const outs = links.filter((l) => l.from === cur && l.prio === 0)
      if (outs.length !== 1) { ok = outs.length === 0; break }
      cur = outs[0].to
    }
    if (!ok || !chain.length) continue
    const last = chain[chain.length - 1], y = mainOut[0]
    m.prio = 0
    links = links.filter((l) => l !== y && !(endId && l.from === last && l.to === endId))
    links.push({ from: last, to: y.to, label: y.label, prio: 0 })
    if (endId && nodes.get(endId)!.name) links.push({ from: last, to: endId, prio: 1 })
    else if (endId) { nodes.delete(endId); links = links.filter((l) => l.to !== endId && l.from !== endId) }
  }

  // ---------- checks: plain Yes / No paths ----------
  for (const n of nodes.values()) {
    if (n.kind !== 'decision') continue
    const outs = links.filter((l) => l.from === n.id && l.prio === 0)
    const no = outs.find((l) => NEG.test(l.label ?? ''))
    const yes = outs.filter((l) => l !== no && POS.test(l.label ?? ''))
    if (!n.name) {
      // an unnamed check: name it from its paths, e.g. "Approved?" or "Standard or urgent?"
      const named = outs.map((l) => l.label).filter(Boolean) as string[]
      const word = yes[0]?.label && !/^(yes|y|ja|si|oui|ok|okay|true)$/i.test(yes[0].label) ? yes[0].label : ''
      n.name = word && no ? `${word.replace(/^./, (c) => c.toUpperCase())}?` : named.length >= 2 ? `${named.join(' or ')}?` : 'Which way?'
    }
    if (no) no.label = 'No'
    yes.forEach((l) => { l.label = 'Yes' })
    if (no && !yes.length) { const other = outs.filter((l) => l !== no); if (other.length === 1) other[0].label = 'Yes' }
  }

  // ---------- reading order: follow the usual path from the start, then by position ----------
  const order: string[] = []
  const visit = (id: string) => {
    if (order.includes(id) || !nodes.has(id)) return
    order.push(id)
    links.filter((l) => l.from === id)
      .sort((a, b) => a.prio - b.prio || Number(a.label === 'No') - Number(b.label === 'No') || (nodes.get(a.to)?.box?.x ?? 0) - (nodes.get(b.to)?.box?.x ?? 0))
      .forEach((l) => visit(l.to))
  }
  const pos = (n: Node) => (n.box ? n.box.x * 10 + n.box.y / 1000 : 1e12)
  const startNodes = [...nodes.values()].filter((n) => n.kind === 'start').sort((a, b) => pos(a) - pos(b))
  startNodes.forEach((n) => visit(n.id))
  ;[...nodes.values()].sort((a, b) => pos(a) - pos(b)).forEach((n) => visit(n.id))
  // how far each step is from the start (ignoring loops back) — the reading order when there are no positions
  const level = new Map<string, number>()
  const queue = startNodes.map((n) => n.id)
  queue.forEach((id) => level.set(id, 0))
  while (queue.length) {
    const id = queue.shift()!
    for (const l of links.filter((x) => x.from === id && x.prio < 2)) if (!level.has(l.to)) { level.set(l.to, level.get(id)! + 1); queue.push(l.to) }
  }
  // steps only reached through a "What if…?" path come last in their stage
  const sideOnly = (id: string) => { const ins = links.filter((l) => l.to === id); return ins.length > 0 && ins.every((l) => l.prio === 2) }
  const hasPos = order.every((id) => nodes.get(id)!.box || nodes.get(id)!.kind === 'start' || nodes.get(id)!.kind === 'end')
  const readKey = (n: Node) => hasPos && n.box ? centre(n.box).x : (level.get(n.id) ?? 1e6) * 1000 + order.indexOf(n.id)
  const byReading = (a: Node, b: Node) => Number(sideOnly(a.id)) - Number(sideOnly(b.id)) || readKey(a) - readKey(b) || (a.box && b.box ? centre(a.box).y - centre(b.box).y : 0)
  const ordered = order.map((id) => nodes.get(id)!)
  const work = ordered.filter((n) => n.kind === 'step' || n.kind === 'decision')
  if (!work.length) throw new Error('No tasks were found in this diagram.')
  // without groups, steps are chunked into stages in reading order (side paths still after the main path)
  work.sort((a, b) => readKey(a) - readKey(b) || Number(sideOnly(a.id)) - Number(sideOnly(b.id)))

  // ---------- stages ----------
  const stageOf = new Map<string, number>()
  const stageNames: string[] = []
  // 1) Signavio groups, matched by position on the diagram
  const catValue = new Map(all(defs, 'categoryValue').map((c) => [c.getAttribute('id') ?? '', clean(c.getAttribute('value'))]))
  const groups = all(defs, 'group')
    .map((g) => ({ name: catValue.get(g.getAttribute('categoryValueRef') ?? '') || clean(g.getAttribute('name')), box: boxes.get(g.getAttribute('id') ?? '') }))
    .filter((g): g is { name: string; box: Box } => !!g.box)
    .sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y)
  const keyOf = new Map<string, string>()
  if (groups.length) {
    for (const n of work) {
      if (!n.box) continue
      const c = centre(n.box)
      const g = groups.filter((x) => inside(c, x.box)).sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0]
      if (g) keyOf.set(n.id, `g${groups.indexOf(g)}`)
    }
  }
  // 2) otherwise, expanded sub-processes (the outermost one a step sits in)
  if (!keyOf.size && subs.length) {
    const top = (n: Node): string | undefined => { let s = n.sub, last: string | undefined; const subIds = new Map(subs.map((x) => [x.id, x])); while (s) { last = s; s = subIds.get(s)?.sub } return last }
    for (const n of work) { const t = top(n); if (t) keyOf.set(n.id, `s${t}`) }
  }
  let auto = false
  if (keyOf.size) {
    const loose = work.filter((n) => !keyOf.has(n.id))
    // where are the groups / sub-processes on the diagram (left to right)?
    const bands = [...new Set(keyOf.values())].map((k) => {
      const box = k.startsWith('g') ? groups[+k.slice(1)].box : subs.find((x) => x.id === k.slice(1))?.box
      return box ? { k, x0: box.x, x1: box.x + box.w } : null
    }).filter((b): b is { k: string; x0: number; x1: number } => !!b).sort((a, b) => a.x0 - b.x0)
    if (hasPos && bands.length) {
      // a step outside them belongs to the group in its column; steps between groups form stages of their own
      const gaps = new Map<number, Node[]>()
      for (const n of loose) {
        const cx = centre(n.box!).x
        const band = bands.find((b) => cx >= b.x0 && cx <= b.x1)
        if (band) { keyOf.set(n.id, band.k); continue }
        const gi = bands.filter((b) => b.x1 < cx).length
        gaps.set(gi, [...(gaps.get(gi) ?? []), n])
      }
      // long stretches are cut into readable chunks, so a big diagram ends up with about 8 stages
      const gapSteps = [...gaps.values()].reduce((a, g) => a + g.length, 0)
      const size = Math.max(6, Math.ceil(gapSteps / Math.max(1, 8 - bands.length)))
      for (const [gi, list] of gaps) {
        const parts = Math.max(1, Math.round(list.length / size))
        const per = Math.ceil(list.length / parts)
        list.forEach((n, i) => keyOf.set(n.id, `r${gi}-${Math.floor(i / per)}`))
      }
    } else {
      // no positions: a run of steps outside them becomes a stage of its own…
      let run: Node[] = [], runNo = 0
      const flush = () => { if (run.length >= 2) { const k = `r${runNo++}`; run.forEach((n) => keyOf.set(n.id, k)) } run = [] }
      for (const n of work) { if (keyOf.has(n.id)) flush(); else run.push(n) }
      flush()
    }
    // …and a single one left over joins the stage of the step before it (or after, at the start)
    let prev: string | undefined
    for (const n of work) { if (keyOf.has(n.id)) prev = keyOf.get(n.id); else if (prev) keyOf.set(n.id, prev) }
    let next: string | undefined
    for (const n of [...work].reverse()) { if (keyOf.has(n.id)) next = keyOf.get(n.id); else if (next) keyOf.set(n.id, next) }
    // stages in reading order (left to right on the diagram)
    const keys = [...new Set(work.map((n) => keyOf.get(n.id)!))]
    // in the order the work reaches them from the start (ties keep the left-to-right order)
    const reached = (k: string) => Math.min(...work.filter((n) => keyOf.get(n.id) === k).map((n) => level.get(n.id) ?? 1e6))
    keys.sort((a, b) => reached(a) - reached(b))
    keys.forEach((k, i) => {
      stageNames.push(k.startsWith('g') ? groups[+k.slice(1)].name : k.startsWith('s') ? clean(subs.find((s) => s.id === k.slice(1))?.name) : '')
      work.filter((n) => keyOf.get(n.id) === k).forEach((n) => stageOf.set(n.id, i))
    })
  } else {
    // 3) no grouping in the diagram: split the steps evenly, in reading order
    auto = true
    const count = work.length <= 4 ? 1 : Math.min(6, Math.ceil(work.length / 4))
    const size = Math.ceil(work.length / count)
    work.forEach((n, i) => stageOf.set(n.id, Math.floor(i / size)))
    for (let i = 0; i < count; i++) stageNames.push('')
    warnings.push('The diagram has no groups, so its steps were split into stages automatically. Add groups in Signavio to name the stages.')
  }

  // ---------- data stores, documents, notes ----------
  const dataName = new Map<string, { name: string; system: boolean }>()
  for (const d of [...all(defs, 'dataStoreReference'), ...all(defs, 'dataObjectReference'), ...all(defs, 'dataStore'), ...all(defs, 'dataObject')]) {
    const sig = all(d, 'signavioType')[0]?.getAttribute('dataObjectType') ?? ''
    const isSystem = d.localName.startsWith('dataStore') || /it.?system|system|application/i.test(sig)
    const name = clean(d.getAttribute('name'))
    if (name) dataName.set(d.getAttribute('id') ?? '', { name, system: isSystem })
  }
  const annotations = new Map(all(defs, 'textAnnotation').map((t) => [t.getAttribute('id') ?? '', clean(kids(t, 'text')[0]?.textContent)]))
  const extra = new Map<string, { systems: Set<string>; docs: Set<string>; notes: string[] }>()
  const bag = (id: string) => { let b = extra.get(id); if (!b) { b = { systems: new Set(), docs: new Set(), notes: [] }; extra.set(id, b) } return b }
  const addData = (nodeId: string, ref: string) => {
    const d = dataName.get(ref); if (d && nodes.has(nodeId)) (d.system ? bag(nodeId).systems : bag(nodeId).docs).add(d.name)
    const t = annotations.get(ref); if (t && nodes.has(nodeId)) bag(nodeId).notes.push(t)
  }
  for (const n of nodes.values()) {
    for (const a of kids(n.el, 'dataInputAssociation')) kids(a, 'sourceRef').forEach((r) => addData(n.id, clean(r.textContent)))
    for (const a of kids(n.el, 'dataOutputAssociation')) kids(a, 'targetRef').forEach((r) => addData(n.id, clean(r.textContent)))
  }
  for (const a of all(defs, 'association')) {
    const s = a.getAttribute('sourceRef') ?? '', t = a.getAttribute('targetRef') ?? ''
    if (nodes.has(s)) addData(s, t); else if (nodes.has(t)) addData(t, s)
  }

  // ---------- library links from Signavio metadata ----------
  const library: LibraryItem[] = []
  const linkIds = (el: Element) => metaLinks(el).map(({ title, url }) => {
    const id = `bpmn-doc-${hash(url)}`
    if (!library.some((x) => x.id === id)) library.push({ id, title, url, category: categoryFor(title), tags: ['Signavio'] })
    return id
  })

  // ---------- build the process ----------
  const stageCount = stageNames.length
  // final order: start, then stage by stage in reading order, then finish
  const stageIdx = (n: Node) => stageOf.get(n.id) ?? (n.kind === 'start' ? -1 : 1e3)
  ordered.sort((a, b) => Number(b.kind === 'start') - Number(a.kind === 'start') || Number(a.kind === 'end') - Number(b.kind === 'end') || stageIdx(a) - stageIdx(b) || byReading(a, b))
  work.sort((a, b) => stageIdx(a) - stageIdx(b) || byReading(a, b))
  const steps: Step[] = ordered.map((n) => {
    const preds = links.filter((l) => l.to === n.id).map((l) => stageOf.get(l.from)).filter((x) => x !== undefined) as number[]
    const succs = links.filter((l) => l.from === n.id).map((l) => stageOf.get(l.to)).filter((x) => x !== undefined) as number[]
    const si = stageOf.get(n.id) ?? (n.kind === 'end' ? (preds.length ? Math.max(...preds) : stageCount - 1) : n.kind === 'start' ? (succs.length ? Math.min(...succs) : 0) : 0)
    const label = n.name || (n.kind === 'start' ? 'Start' : n.kind === 'end' ? 'Finish' : n.kind === 'decision' ? 'Which way?' : 'Untitled step')
    const step: Step = { id: n.id, kind: n.kind as Step['kind'], label, roleId: n.roleId, stageId: `st${si + 1}` }
    if (n.kind === 'step' || n.kind === 'decision') {
      const text = docText(n.el)
      const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*([-*•·]|\d+[.)])\s*/, '').trim()).filter(Boolean)
      if (lines.length > 1) step.how = lines
      else if (lines.length === 1) step.why = lines[0]
      const notes = extra.get(n.id)?.notes ?? []
      if (!step.why && notes.length) step.why = notes.join(' ')
      const res = linkIds(n.el)
      if (res.length) { step.resourceIds = res; step.resourcesTouched = true }
    }
    return step
  })

  const edges: Edge[] = links
    .sort((a, b) => a.prio - b.prio)
    .map((l, i) => ({ id: `e${i + 1}`, from: l.from, to: l.to, ...(l.label ? { label: l.label } : {}) }))

  const stages: Stage[] = stageNames.map((name, i) => {
    const id = `st${i + 1}`
    const inStage = work.filter((n) => stageOf.get(n.id) === i)
    const roleCount = new Map<string, number>()
    inStage.forEach((n) => roleCount.set(n.roleId, (roleCount.get(n.roleId) ?? 0) + 1))
    const mainRole = [...roleCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const roleNames = [...roleCount.keys()].map((r) => roles.find((x) => x.id === r)?.name).filter(Boolean) as string[]
    const fromStep = (t: string) => { const w = t.replace(/\?$/, '').split(' '); return w.length > 7 ? `${w.slice(0, 6).join(' ')}…` : w.join(' ') }
    const title = name || fromStep(inStage[0]?.name ?? `Stage ${i + 1}`)
    const labels = inStage.map((n) => n.name || 'Untitled step')
    const text = `${roleNames.length > 1 ? `${roleNames.slice(0, -1).join(', ')} and ${roleNames[roleNames.length - 1]}` : roleNames[0] ?? 'The team'}: ${labels.join(' → ')}.`
    return {
      id, title, short: title.split(' ').filter((w) => /\w/.test(w)).slice(0, 3).join(' ').replace(/…$/, ''),
      place: roles.find((r) => r.id === mainRole)?.name ?? '',
      text, color: STAGE_COLORS[i % STAGE_COLORS.length],
      systems: [...new Set(inStage.flatMap((n) => [...(extra.get(n.id)?.systems ?? [])]))],
      docs: [...new Set(inStage.flatMap((n) => [...(extra.get(n.id)?.docs ?? [])]))],
      roleIds: [], scene: 'auto',
    }
  })

  const label = (id: string) => nodes.get(id)?.name || ''
  const triggers = [...new Set(steps.filter((s) => s.kind === 'start').map((s) => s.label).filter((l) => l !== 'Start'))]
  // the finish in the last stage (the usual ending) comes first
  const outcomes = [...new Set(steps.filter((s) => s.kind === 'end').reverse().map((s) => s.label).filter((l) => l !== 'Finish'))]

  // ---------- titles and text ----------
  const base = src.file.replace(/\.(bpmn2?|xml)$/i, '').replace(/[_]+/g, ' ').trim()
  const looksLikeId = (s: string) => !s || /^(sid-)?[0-9a-f-]{12,}$/i.test(s)
  const procName = clean(procs[0].getAttribute('name')) || clean(participants[0]?.getAttribute('name'))
  let title = looksLikeId(base) ? procName || base : base
  let code: string | undefined
  const m = title.match(/^([A-Z]{1,6}[-.]?\d{1,4}(?:\.\d+)*)\s*[-–:·]?\s+(.+)$/)
  if (m) { code = m[1]; title = m[2] }
  const description = docText(procs[0]) || (participants[0] ? docText(participants[0]) : '') || docText(defs)
  // Signavio keeps the process owner with the diagram (signavioDiagramMetaData, e.g. meta-processowner)
  const diagramMeta = all(defs, 'signavioDiagramMetaData').map((m) => ({ key: m.getAttribute('metaKey') ?? '', value: m.getAttribute('metaValue') ?? '' }))
  const ownerMeta = [...diagramMeta, ...[...procs, ...participants, defs].flatMap(meta)].find((x) => /owner|verantwort|responsib|eigent/i.test(x.key) && clean(x.value) && !/^\[?\]?$/.test(x.value))
  let owner = ownerMeta ? clean(ownerMeta.value).replace(/^\[?"?|"?\]?$/g, '') : ''
  if (/^[{[]/.test(owner)) owner = ''
  const roleList = roles.map((r) => r.name)
  const nutshell = [
    triggers.length ? `It starts with “${triggers[0].replace(/\.$/, '')}”.` : '',
    `${roleList.length > 1 ? `${roleList.slice(0, -1).join(', ')} and ${roleList[roleList.length - 1]} work` : `${roleList[0]} works`} through ${stages.length === 1 ? 'it' : `${stages.length} stages: ${stages.map((s) => s.title).join(', ')}`}.`,
    outcomes.length ? `It ends with “${outcomes[0].replace(/\.$/, '')}”.` : '',
  ].filter(Boolean).join(' ')

  // "What if…?": each boundary event, and the step its path leads to
  const whatIf = exceptions.map(({ on, what }) => {
    const to = links.find((l) => l.from === on && l.prio === 2 && l.label === what)?.to
    return { case: `${what} (${label(on)})`, handled: (to && label(to)) || 'See the diagram' }
  })

  const notes = [`Shown from the Signavio model “${src.file}”. To change it, update the model in Signavio and export it to the SharePoint folder again.`]
  if (auto) notes.push('The diagram has no groups, so the stages were made automatically — add groups in Signavio to name them.')

  const process: Process = {
    id: `bpmn-${slug(src.path ?? src.file)}`,
    ...(code ? { code } : {}),
    title,
    area: src.folder || 'From Signavio',
    summary: description.split(/\n\s*\n/)[0]?.trim() || `${title}: ${work.length} steps across ${roleList.length} role${roleList.length === 1 ? '' : 's'}, from the Signavio model.`,
    nutshell,
    owner: owner || 'Process Owner',
    status: 'published',
    needsCompleting: false,
    draftNote: notes.join(' '),
    triggers: triggers.length ? triggers : ['The process starts'],
    outcomes: outcomes.length ? outcomes : ['The process is finished'],
    roles,
    stages,
    steps,
    edges,
    resources: [],
    roleDetails: [],
    exceptions: whatIf,
    updatedAt: src.modified || new Date().toISOString(),
    source: { kind: 'bpmn', file: src.file, path: src.path, modified: src.modified },
  }
  return { process, library, warnings }
}
