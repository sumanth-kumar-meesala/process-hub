/**
 * parseBpmn — Office Script that turns a Signavio BPMN 2.0 XML export into a readable process (JSON text).
 *
 * Called by the "Sync processes" Power Automate flow (Excel Online (Business) → Run script) with the file's text and name.
 * Never throws: on a bad file it returns {"error": "..."} so the flow can record it.
 *
 * Signavio → timeline:
 *   lanes (or pools without lanes)              → role of each step
 *   tasks, call activities, collapsed sub-procs → steps (documentation → "how", linked annotations → notes, data objects → documents)
 *   gateways with 2+ outgoing paths             → decisions, with one branch per path (path name → branch label)
 *   start / end events                          → "Starts when" / "Done when"
 *   groups and expanded sub-processes           → stages; other steps are split into stages at the widest gaps on the diagram
 *   boundary events                             → "What if…" on the step they sit on
 * Steps are in reading order: left to right on the diagram, top to bottom in a column.
 */

interface XNode { tag: string; attrs: { [k: string]: string }; kids: XNode[]; text: string; parent: XNode | null }
interface Box { x: number; y: number; w: number; h: number }
interface Flow { from: string; to: string; name: string }
interface Doc { name: string; url: string }
interface Branch { label: string; to: string }
interface Row {
  n: number          // row number (0, 1, 2…) — stage rows and step rows together, in display order
  k: string          // "stage" | "task" | "auto" (automated) | "decision" | "event"
  s: number          // stage index
  num: string        // "2" for a stage, "2.3" for a step
  title: string
  color: string      // stage colour
  role: string
  how: string
  notes: string[]
  docs: Doc[]
  branches: Branch[] // decisions: label → where it goes; other steps: what happens next
  whatIf: Branch[]
  count: number      // stage rows: number of steps in the stage
}
interface Result {
  code: string; title: string; owner: string; ownerEmail: string; summary: string; gaps: string; parkingLot: string
  roles: string[]; triggers: string[]; outcomes: string[]; notes: string[]; warnings: string[]
  stageCount: number; stepCount: number; rows: Row[]; parsedAt: string
}

function main(workbook: ExcelScript.Workbook, xml: string, fileName: string): string {
  try {
    return publish(parse(xml, fileName || ""))
  } catch (e) {
    return JSON.stringify({ error: `Could not read ${fileName || 'the file'}: ${String(e)}` })
  }
}

// ---------- a small XML reader (Office Scripts has no DOMParser) ----------

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m: string, e: string) => {
    const l = e.toLowerCase()
    if (l === 'amp') return '&'
    if (l === 'lt') return '<'
    if (l === 'gt') return '>'
    if (l === 'quot') return '"'
    if (l === 'apos') return "'"
    return String.fromCodePoint(l.startsWith('#x') ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10))
  })
}

function readXml(xml: string): XNode {
  const root: XNode = { tag: '#root', attrs: {}, kids: [], text: '', parent: null }
  let cur = root
  const tok = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  const att = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = tok.exec(xml)) !== null) {
    if (m[1] !== undefined) { cur.text += m[1]; continue }
    if (m[6] !== undefined) { cur.text += decode(m[6]); continue }
    if (!m[3]) continue // comment, <?xml?>, doctype
    const tag = m[3].replace(/^.*:/, '') // drop the namespace prefix
    if (m[2] === '/') { if (cur.parent) cur = cur.parent; continue }
    const attrs: { [k: string]: string } = {}
    let a: RegExpExecArray | null
    att.lastIndex = 0
    while ((a = att.exec(m[4])) !== null) attrs[a[1].replace(/^.*:/, '')] = decode(a[2] !== undefined ? a[2] : a[3])
    const node: XNode = { tag, attrs, kids: [], text: '', parent: cur }
    cur.kids.push(node)
    if (m[5] !== '/') cur = node
  }
  return root
}

function walk(n: XNode, visit: (n: XNode) => void): void {
  visit(n)
  for (const k of n.kids) walk(k, visit)
}
const kid = (n: XNode, tag: string): XNode | undefined => n.kids.find((k) => k.tag === tag)
const kidText = (n: XNode, tag: string): string => (kid(n, tag)?.text ?? '').trim()
const tidy = (s: string): string => (s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
const oneLine = (s: string): string => tidy(s).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ')

/** Signavio's extra attributes: <signavio:signavioMetaData metaKey="…" metaValue="…"/>. */
function meta(n: XNode, key: string): string {
  const ext = kid(n, 'extensionElements')
  const m = ext?.kids.find((k) => (k.tag === 'signavioMetaData' || k.tag === 'signavioDiagramMetaData') && k.attrs.metaKey === key)
  return m ? m.attrs.metaValue : ''
}

function docLinks(n: XNode): Doc[] {
  const raw = meta(n, 'meta-documentlink')
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as { label?: string; url?: string }[]
    return Array.isArray(v) ? v.filter((d) => d && d.url).map((d) => ({ name: oneLine(d.label || d.url || ''), url: d.url || '' })) : []
  } catch (e) { return [] }
}

// ---------- BPMN → process ----------

const TASKS = ['task', 'userTask', 'serviceTask', 'manualTask', 'sendTask', 'receiveTask', 'businessRuleTask', 'scriptTask', 'callActivity']
const GATEWAYS = ['exclusiveGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway', 'parallelGateway']
const EVENTS = ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent']
const FLOW_NODES = TASKS.concat(GATEWAYS, EVENTS, ['subProcess', 'transaction', 'adHocSubProcess'])
const SUBS = ['subProcess', 'transaction', 'adHocSubProcess']
// Fluent-style colours that read on white, one per stage (repeats after ten)
const PALETTE = ['#0F6CBD', '#8764B8', '#038387', '#CA5010', '#4F6BED', '#C239B3', '#498205', '#986F0B', '#D13438', '#005B70']

function parse(xml: string, fileName: string): Result {
  if (!/<(\w+:)?definitions[\s>]/.test(xml)) throw new Error('this is not a BPMN 2.0 XML file (no <definitions>)')
  const root = readXml(xml)
  const warnings: string[] = []

  const byId: { [id: string]: XNode } = {}
  const pool: { [processId: string]: string } = {}
  const lane: { [nodeId: string]: string } = {}
  const box: { [id: string]: Box } = {}
  const flows: Flow[] = []
  const messages: Flow[] = []
  const links: Flow[] = []                   // associations: annotation/data object ↔ step
  const io: { task: string; data: string }[] = [] // data objects read or written by a step
  const groups: XNode[] = []
  const categoryName: { [id: string]: string } = {}

  walk(root, (n) => {
    if (n.attrs.id) byId[n.attrs.id] = n
    switch (n.tag) {
      case 'participant': if (n.attrs.processRef) pool[n.attrs.processRef] = oneLine(n.attrs.name || ''); break
      case 'lane': for (const r of n.kids) if (r.tag === 'flowNodeRef') lane[r.text.trim()] = oneLine(n.attrs.name || '') // child lanes come later and win
        break
      case 'sequenceFlow': flows.push({ from: n.attrs.sourceRef, to: n.attrs.targetRef, name: oneLine(n.attrs.name || '') }); break
      case 'messageFlow': messages.push({ from: n.attrs.sourceRef, to: n.attrs.targetRef, name: oneLine(n.attrs.name || '') }); break
      case 'association': links.push({ from: n.attrs.sourceRef, to: n.attrs.targetRef, name: '' }); break
      case 'dataInputAssociation': if (n.parent) for (const s of n.kids) if (s.tag === 'sourceRef') io.push({ task: n.parent.attrs.id, data: s.text.trim() })
        break
      case 'dataOutputAssociation': if (n.parent) io.push({ task: n.parent.attrs.id, data: kidText(n, 'targetRef') }); break
      case 'group': groups.push(n); break
      case 'categoryValue': categoryName[n.attrs.id] = oneLine(n.attrs.value || ''); break
      case 'BPMNShape': {
        const b = kid(n, 'Bounds')
        if (b) box[n.attrs.bpmnElement] = { x: +b.attrs.x || 0, y: +b.attrs.y || 0, w: +b.attrs.width || 0, h: +b.attrs.height || 0 }
        break
      }
    }
  })

  const nameOf = (n: XNode | undefined): string => oneLine(n?.attrs.name || '')
  const isFlowNode = (n: XNode): boolean => FLOW_NODES.indexOf(n.tag) >= 0
  const enclosing = (n: XNode, tags: string[]): XNode | null => {
    for (let p = n.parent; p; p = p.parent) if (tags.indexOf(p.tag) >= 0) return p
    return null
  }
  const isExpanded = (n: XNode): boolean => SUBS.indexOf(n.tag) >= 0 && n.kids.some((x) => isFlowNode(x))
  const outOf = (id: string): Flow[] => flows.filter((f) => f.from === id)
  const roleOf = (n: XNode): string => {
    if (lane[n.attrs.id]) return lane[n.attrs.id]
    const sub = enclosing(n, SUBS)
    if (sub) return roleOf(sub)
    const proc = enclosing(n, ['process'])
    return (proc && pool[proc.attrs.id]) || 'Not assigned'
  }

  // which flow nodes become steps
  const isStep = (n: XNode): boolean =>
    TASKS.indexOf(n.tag) >= 0 ||
    (SUBS.indexOf(n.tag) >= 0 && !isExpanded(n)) ||
    (GATEWAYS.indexOf(n.tag) >= 0 && n.tag !== 'parallelGateway' && outOf(n.attrs.id).length > 1) ||
    ((n.tag === 'intermediateCatchEvent' || n.tag === 'intermediateThrowEvent') && !!nameOf(n))
  const all: XNode[] = []
  walk(root, (n) => { if (isFlowNode(n)) all.push(n) })
  const steps = all.filter((x) => isStep(x))
  if (!steps.length) throw new Error('no tasks were found in the diagram')

  // reading order: by column (left edge), then top to bottom
  const pos = (n: XNode): Box => box[n.attrs.id] || { x: 1e9, y: 1e9, w: 0, h: 0 }
  steps.sort((a, b) => pos(a).x - pos(b).x || pos(a).y - pos(b).y)

  // ---------- where each path leads: the next steps, skipping merges, parallel splits and unnamed events ----------
  interface Target { step: XNode | null; end: string }
  const resolve = (id: string, seen: { [id: string]: boolean }): Target[] => {
    if (seen[id]) return []
    seen[id] = true
    const n = byId[id]
    if (!n) return []
    if (isStep(n)) return [{ step: n, end: '' }]
    if (isExpanded(n)) { // into a sub-process: its start events
      const starts = n.kids.filter((k) => k.tag === 'startEvent')
      return starts.length ? starts.reduce((acc: Target[], s) => acc.concat(resolve(s.attrs.id, seen)), []) : outOf(id).reduce((acc: Target[], f) => acc.concat(resolve(f.to, seen)), [])
    }
    if (n.tag === 'endEvent') {
      const sub = enclosing(n, SUBS)
      if (sub && outOf(sub.attrs.id).length) return outOf(sub.attrs.id).reduce((acc: Target[], f) => acc.concat(resolve(f.to, seen)), [])
      return [{ step: null, end: nameOf(n) || 'Finish' }]
    }
    const next = outOf(id)
    if (!next.length && enclosing(n, SUBS)) { // last node in a sub-process without an end event
      const sub = enclosing(n, SUBS) as XNode
      return outOf(sub.attrs.id).reduce((acc: Target[], f) => acc.concat(resolve(f.to, seen)), [])
    }
    return next.reduce((acc: Target[], f) => acc.concat(resolve(f.to, seen)), [])
  }
  const label = (t: Target): string => t.step ? stepTitle(t.step) : `Finish: ${t.end}`
  // long multi-line names ("NEXT-STEP HANDOVER\nTrigger: …\nTask: …"): the first line is the title, the rest goes to "how"
  const nameParts = (n: XNode): string[] => {
    const raw = tidy(n.attrs.name || '')
    const i = raw.indexOf('\n')
    return i > 0 && raw.length > 80 ? [oneLine(raw.slice(0, i)), tidy(raw.slice(i + 1))] : [oneLine(raw), '']
  }
  // the nearest named step before a node, through merges and other gateways
  const stepBefore = (id: string): XNode | undefined => {
    const seen: { [id: string]: boolean } = {}
    let todo = [id]
    while (todo.length) {
      const next: string[] = []
      for (const t of todo) for (const f of flows.filter((x) => x.to === t)) {
        const p = byId[f.from]
        if (!p || seen[f.from]) continue
        seen[f.from] = true
        if (TASKS.indexOf(p.tag) >= 0 || SUBS.indexOf(p.tag) >= 0) return p
        next.push(f.from)
      }
      todo = next
    }
    return undefined
  }
  const stepTitle = (n: XNode): string => {
    if (GATEWAYS.indexOf(n.tag) < 0) return nameParts(n)[0] || 'Untitled step'
    if (nameOf(n)) return nameOf(n)
    const names = outOf(n.attrs.id).map((f) => f.name).filter((x) => x)
    if (names.length >= 2 && names.join(' or ').length <= 90) return `${names.join(' or ')}?`
    const before = stepBefore(n.attrs.id)
    return before ? `Check after “${nameParts(before)[0]}”` : 'Which way?'
  }
  const uniq = (xs: Branch[]): Branch[] => xs.filter((x, i) => xs.findIndex((y) => y.label === x.label && y.to === x.to) === i)

  // ---------- stages ----------
  // groups: the group whose box holds the step's centre; expanded sub-process: the nearest one around the step
  const stageKey: { [id: string]: string } = {}
  const stageName: { [key: string]: string } = {}
  for (const s of steps) {
    const p = pos(s), cx = p.x + p.w / 2, cy = p.y + p.h / 2
    const g = groups.find((gr) => { const b = box[gr.attrs.id]; return b && cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h })
    const sub = enclosing(s, SUBS)
    if (g) { stageKey[s.attrs.id] = 'g' + g.attrs.id; stageName['g' + g.attrs.id] = categoryName[g.attrs.categoryValueRef] || nameOf(g) }
    else if (sub) { stageKey[s.attrs.id] = 's' + sub.attrs.id; stageName['s' + sub.attrs.id] = nameOf(sub) }
  }
  // the other steps, in reading order, are cut into stages of about 8: near each even split point, at the widest column gap
  const loose = steps.filter((s) => !stageKey[s.attrs.id])
  if (loose.length) {
    const want = Math.max(1, Math.round(loose.length / 8))
    const gap = (i: number): number => pos(loose[i]).x - pos(loose[i - 1]).x
    const cuts: number[] = [0]
    for (let k = 1; k < want; k++) {
      const ideal = Math.round((k * loose.length) / want)
      let best = -1
      for (let i = Math.max(cuts[cuts.length - 1] + 3, ideal - 3); i <= Math.min(loose.length - 3, ideal + 3); i++) if (best < 0 || gap(i) > gap(best)) best = i
      if (best > 0) cuts.push(best)
    }
    loose.forEach((s, i) => {
      let part = 0
      cuts.forEach((c, j) => { if (i >= c) part = j })
      stageKey[s.attrs.id] = `a${part}`
    })
    if (!groups.length) warnings.push('The diagram has no groups, so stages were made automatically. Add groups in Signavio to name them.')
  }

  const stageOrder: string[] = []
  for (const s of steps) if (stageOrder.indexOf(stageKey[s.attrs.id]) < 0) stageOrder.push(stageKey[s.attrs.id])
  // a step's stage keeps reading order: group the steps stage by stage, in the order the stages first appear
  const ordered = stageOrder.reduce((acc: XNode[], k) => acc.concat(steps.filter((s) => stageKey[s.attrs.id] === k)), [])

  // ---------- annotations and documents ----------
  const annotationsOf = (id: string): string[] => links
    .filter((l) => l.from === id || l.to === id)
    .map((l) => byId[l.from === id ? l.to : l.from])
    .filter((n) => n && n.tag === 'textAnnotation')
    .map((n) => tidy(kidText(n, 'text')).replace(/^note\s*:\s*/i, ''))
    .filter((t) => t)
  const dataName = (n: XNode): string => {
    const target = n.tag === 'dataObjectReference' && n.attrs.dataObjectRef ? byId[n.attrs.dataObjectRef] : undefined
    return nameOf(n) || nameOf(target)
  }
  const docsOf = (s: XNode): Doc[] => {
    const ids = io.filter((x) => x.task === s.attrs.id).map((x) => x.data)
      .concat(links.filter((l) => l.from === s.attrs.id || l.to === s.attrs.id).map((l) => l.from === s.attrs.id ? l.to : l.from))
    const docs: Doc[] = docLinks(s)
    for (const id of ids) {
      const d = byId[id]
      if (!d || (d.tag !== 'dataObjectReference' && d.tag !== 'dataStoreReference')) continue
      const links2 = docLinks(d)
      if (links2.length) links2.forEach((l) => docs.push({ name: dataName(d) || l.name, url: l.url }))
      else if (dataName(d)) docs.push({ name: dataName(d), url: '' })
    }
    return docs.filter((d, i) => docs.findIndex((e) => e.name.toLowerCase() === d.name.toLowerCase()) === i)
  }

  // notes not tied to a step; "Process name:" / "PROCESS DESCRIPTION:" notes describe the process, or a sub-process when inside one
  const used: { [id: string]: boolean } = {}
  for (const s of steps) for (const l of links) { if (l.from === s.attrs.id) used[l.to] = true; if (l.to === s.attrs.id) used[l.from] = true }
  const freeNotes = Object.keys(byId).map((id) => byId[id]).filter((n) => n.tag === 'textAnnotation' && !used[n.attrs.id])
  const noteText = (n: XNode): string => tidy(kidText(n, 'text'))
  const isHeader = (t: string): boolean => /^process\s*name\s*:/i.test(t)
  const isDescription = (t: string): boolean => /^process\s*description\s*:/i.test(t)
  const describes = (inside: XNode | null): XNode[] => freeNotes.filter((n) => enclosing(n, SUBS) === inside)
  const cut = (s: string, n: number): string => s.length > n ? s.slice(0, n - 1).replace(/\s+$/, '') + '…' : s

  // ---------- rows ----------
  const rows: Row[] = []
  const roles: string[] = []
  const blank = (): Row => ({ n: 0, k: '', s: 0, num: '', title: '', color: '', role: '', how: '', notes: [], docs: [], branches: [], whatIf: [], count: 0 })
  stageOrder.forEach((key, si) => {
    const inStage = ordered.filter((s) => stageKey[s.attrs.id] === key)
    const color = PALETTE[si % PALETTE.length]
    const sub = key.charAt(0) === 's' ? byId[key.slice(1)] : null
    const about = sub ? describes(sub).map((x) => noteText(x)).find((x) => isDescription(x)) || '' : ''
    rows.push(Object.assign(blank(), { k: 'stage', s: si, num: String(si + 1), color, count: inStage.length,
      title: cut(stageName[key] || stepTitle(inStage.find((s) => GATEWAYS.indexOf(s.tag) < 0) || inStage[0]), 70),
      how: tidy(about.replace(/^process\s*description\s*:\s*/i, '')) }))
    inStage.forEach((s, j) => {
      const role = roleOf(s)
      if (roles.indexOf(role) < 0) roles.push(role)
      const isDecision = GATEWAYS.indexOf(s.tag) >= 0
      const branches: Branch[] = []
      for (const f of outOf(s.attrs.id)) for (const t of resolve(f.to, {})) branches.push({ label: isDecision ? (f.name || 'Otherwise') : '', to: label(t) })
      for (const mf of messages.filter((x) => x.from === s.attrs.id)) {
        const t = byId[mf.to]
        if (t) branches.push({ label: mf.name || 'Message', to: `${roleOf(t)}: ${isStep(t) ? stepTitle(t) : nameOf(t) || 'is informed'}` })
      }
      const whatIf: Branch[] = all
        .filter((b) => b.tag === 'boundaryEvent' && b.attrs.attachedToRef === s.attrs.id)
        .map((b) => ({ label: nameOf(b) || 'If something goes wrong', to: outOf(b.attrs.id).reduce((acc: Target[], f) => acc.concat(resolve(f.to, {})), []).map((x) => label(x)).join('; ') || '—' }))
      rows.push(Object.assign(blank(), {
        k: isDecision ? 'decision' : s.tag === 'serviceTask' || s.tag === 'scriptTask' ? 'auto' : s.tag.indexOf('Event') > 0 ? 'event' : 'task',
        s: si, num: `${si + 1}.${j + 1}`, title: stepTitle(s), color, role,
        how: tidy([nameParts(s)[1], kidText(s, 'documentation')].filter((x) => x).join('\n\n')),
        notes: annotationsOf(s.attrs.id),
        docs: docsOf(s),
        branches: uniq(branches), whatIf,
      }))
    })
  })
  rows.forEach((r, i) => { r.n = i })

  // ---------- the process as a whole ----------
  const topLevel = (n: XNode): boolean => !enclosing(n, SUBS)
  const triggers = all.filter((n) => n.tag === 'startEvent' && topLevel(n)).map((x) => nameOf(x)).filter((x) => x)
  const outcomes = all.filter((n) => n.tag === 'endEvent' && topLevel(n)).map((x) => nameOf(x)).filter((x) => x)
  const top = describes(null).map((x) => noteText(x))
  const anywhere = freeNotes.map((x) => noteText(x))
  const header = top.find((x) => isHeader(x)) || anywhere.find((x) => isHeader(x)) || ''
  const described = top.find((x) => isDescription(x)) || anywhere.find((x) => isDescription(x)) || ''
  const defs = root.kids.find((k) => k.tag === 'definitions') || root
  const diagramMeta = (key: string): string => {
    let v = ''
    walk(defs, (n) => { if (!v && n.tag === 'signavioDiagramMetaData' && n.attrs.metaKey === key) v = n.attrs.metaValue })
    return tidy(v)
  }
  const fromFile = fileName.replace(/\.(bpmn2?|xml)$/i, '')
  const headerName = oneLine((header.match(/process\s*name\s*:\s*([^\n]+)/i) || ['', ''])[1])
  // the file name is the most reliable ("AB12 - Approve Purchase Order, All"); the "Process name:" note is the fallback
  const CODE = /^\s*([A-Z]{1,5}\s?\d+[A-Z]?)\b/
  const code = ((fromFile.match(CODE) || headerName.match(CODE) || ['', ''])[1]).replace(/\s/g, '')
  const title = (fromFile || headerName || nameOf(all[0])).replace(/^\s*[A-Z]{1,5}\s?\d+[A-Z]?\s*[-–,:]\s*/, '').trim() || 'Untitled process'

  const unique = (xs: string[]): string[] => xs.filter((x, i) => xs.indexOf(x) === i)
  const result: Result = {
    code, title,
    owner: oneLine((header.match(/process\s*owner\s*:\s*([^\n]+)/i) || ['', ''])[1]) || diagramMeta('meta-processowner'),
    ownerEmail: diagramMeta('meta-processowner'),
    summary: tidy(described.replace(/^process\s*description\s*:\s*/i, '')),
    gaps: all.map((n) => tidy(meta(n, 'meta-impdescription'))).filter((x) => x).join('\n\n'),
    parkingLot: diagramMeta('meta-parkinglot'),
    roles, triggers: unique(triggers), outcomes: unique(outcomes),
    notes: anywhere.filter((t) => t && !isHeader(t) && !isDescription(t)).map((t) => t.replace(/^note\s*:\s*/i, '')),
    warnings,
    stageCount: stageOrder.length, stepCount: steps.length, rows,
    parsedAt: new Date().toISOString(),
  }
  return result
}

// ---------- output: compact rows with a ready-made HTML "detail" for the app ----------

interface OutRow {
  n: number; k: string; s: number; num: string; title: string; color: string; role: string; count: number
  hint: string   // decisions: "Approve → … · Reject → …" for the timeline row
  detail: string // HTML-safe fragment for the details panel: how to do it, notes, documents, what happens next, what if
}

/**
 * The JSON for the list's Data column, kept under 60,000 characters so it fits a SharePoint
 * "multiple lines of text" column (63,999 max): long texts are shortened step by step, with a warning.
 * ponytail: shortens text rather than splitting across columns; add Data2… if real processes hit the cap often.
 */
function publish(r: Result): string {
  const LIMIT = 60000
  for (const max of [1e6, 2000, 1000, 500, 250, 120]) {
    if (max < 1e6 && r.warnings.indexOf('Some long texts were shortened to fit SharePoint.') < 0) r.warnings.push('Some long texts were shortened to fit SharePoint.')
    const out = render(r, max)
    if (out.length <= LIMIT) return out
  }
  throw new Error(`the process is too big for one SharePoint column (${r.stepCount} steps). Split it into smaller diagrams in Signavio.`)
}

function render(r: Result, max: number): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const cut = (s: string, n: number): string => s.length > n ? s.slice(0, n - 1).replace(/\s+$/, '') + '…' : s
  const para = (t: string): string => `<p>${esc(cut(t, max)).replace(/\n/g, '<br>')}</p>`
  const list = (xs: string[]): string => `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`
  const branch = (b: Branch): string => `${b.label ? `<b>${esc(b.label)}</b> → ` : ''}${esc(b.to)}`
  const rows: OutRow[] = r.rows.map((row) => {
    const parts: string[] = []
    if (row.how) parts.push(`<h4>${row.k === 'stage' ? 'About this stage' : 'How to do it'}</h4>${para(row.how)}`)
    if (row.notes.length) parts.push(`<h4>Notes</h4>${row.notes.map((x) => para(x)).join('')}`)
    if (row.docs.length) parts.push(`<h4>Documents</h4>${list(row.docs.map((d) => d.url ? `<a href="${esc(d.url)}" target="_blank">${esc(d.name)}</a>` : esc(d.name)))}`)
    if (row.branches.length) parts.push(`<h4>${row.k === 'decision' ? 'Which way?' : 'What happens next'}</h4>${list(row.branches.map((x) => branch(x)))}`)
    if (row.whatIf.length) parts.push(`<h4>What if…</h4>${list(row.whatIf.map((x) => branch(x)))}`)
    return {
      n: row.n, k: row.k, s: row.s, num: row.num, title: row.title, color: row.color, role: row.role, count: row.count,
      hint: row.k === 'decision' ? cut(row.branches.map((b) => `${b.label} → ${b.to}`).join(' · '), 160) : '',
      detail: parts.join(''),
    }
  })
  return JSON.stringify(Object.assign({}, r, { parkingLot: cut(r.parkingLot, max), gaps: cut(r.gaps, max), notes: r.notes.map((t) => cut(t, max)), rows }))
}
