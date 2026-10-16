import type { LibraryItem, Process } from '@/lib/types'
import type { Op } from './ops'
import { BUILD_SYSTEM, specStats, edgeGaps, type BuildSpec } from './build'
import type { InternalSystem } from '@/data/systems'
import { libraryOutline } from '@/lib/resources'

/**
 * Groq chat for the Builder, written to stay inside small free-tier limits
 * (around 8k tokens per minute on some models):
 *  - the process is sent as a compact text outline, never the full JSON/diagram
 *  - only the last few chat messages go in full; older ones become a short summary
 *  - every request is measured and trimmed to a fixed budget before sending
 *  - the model answers with a small list of edit operations, not a whole process
 *  - on a 429 (rate limit) we wait for the time Groq asks and retry once
 */
export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const INPUT_BUDGET = 6000 // tokens per request, leaves room under ~8k TPM
export const KEEP_MESSAGES = 6
const MAX_OUTPUT = 1500        // small edits
const MAX_OUTPUT_BUILD = 4500  // building a whole process (input stays ~1-2k, so we remain under ~8k/min)

export interface ChatMsg { role: 'user' | 'assistant'; content: string }

/** Rough token estimate (≈4 characters per token for English). */
const systemsList = (sys?: InternalSystem[]) => (sys ?? []).map((x) => `${x.name} — ${x.purpose}`).join('\n')

export const estTokens = (s: string) => Math.ceil(s.length / 4)

/** "Build / create / make a process…", or a still-empty draft → ask for a complete process. */
export const isBuildRequest = (text: string, p: Process) =>
  /\b(build|create|make|design|draft|generate|set up|map)\b[\s\S]{0,40}\bprocess\b/i.test(text) ||
  (p.steps.filter((s) => s.kind === 'step' || s.kind === 'decision').length === 0 && text.trim().split(/\s+/).length > 6)

const SYSTEM = `You help non-technical staff build business processes for "Process Hub".
Write in plain, friendly English (no jargon like BPMN, swimlane, gateway).
A process has ROLES (who; people, teams or an automated tool like "AI assistant"), STAGES (big phases, each shown as a 3D island), STEPS inside a stage done by one role, DECISIONS (yes/no checks), connections between steps, TRIGGERS (what starts it) and OUTCOMES (how you know it's done).
Reply ONLY with JSON: {"reply": "<one or two short sentences to the user>", "ops": [ ... ]}
Allowed ops (refer to roles/stages/steps by ids or names):
{"op":"clear_draft"}  // wipes the canvas; use ONLY when building a new process over an empty or placeholder draft
{"op":"add_role","name":"","kind":"person|agent","tools":["<for agents: MCP servers / APIs it uses>"]}
{"op":"rename_role","role":"","name":""}
{"op":"add_stage","id":"<short id>","title":"","short":"<2-3 words>","place":"<where it happens>","text":"<one plain sentence>","systems":[],"docs":[]}
{"op":"update_stage","stage":"","title":"","short":"","place":"","text":"","systems":[],"docs":[]}
{"op":"add_step","id":"<short id>","label":"<verb first, max 5 words>","role":"","stage":"","kind":"step|decision|start|end","after":"<previous step id — this links them>"}
{"op":"update_step","step":"","label":"","role":"","stage":""}
{"op":"remove_step","step":""}
{"op":"connect","from":"","to":"","label":"Yes|No|"}
{"op":"disconnect","from":"","to":""}
{"op":"attach","step":"<step id>","resource":"<library id, or a new title>","category":"form|client-doc|guide|policy"}
{"op":"detach","step":"","resource":""}
{"op":"set_meta","title":"","summary":"","nutshell":"","audience":"","triggers":[],"outcomes":[]}
Rules:
- Add a stage before any step that uses it, and give stages and steps short ids you reuse (s1, s2… / a1, a2…).
- Chain steps with "after" so every step is connected; for a decision, use "after" for the "Yes" path and add a "connect" with label "No" for the other path.
- Keep labels short. Use generic names (e.g. "Session recording app") unless the user names a real system, document or policy.
- If the request is unclear, ask one question in "reply" and return "ops": [].
- EDGE CASES ("what's missing", "edge cases", "what if"): look for what the process doesn't handle yet — nobody responds in time, rejected/not approved, missing or wrong info, consent withdrawn, AI step unsure or wrong (person takes over), urgent case, cancelled part-way, system down, records not finished. Add a decision with a "No" connect plus the steps to handle each one that applies. In "reply" list what you added in a few words and what was already covered.
- SYSTEMS: use the exact names from INTERNAL SYSTEMS in stage "systems". If you don't know which system the owner uses, ask in "reply".`

const BUILD_HINT = `BUILD MODE: The user wants a COMPLETE process. Return everything in one reply:
1) {"op":"clear_draft"} if the draft is empty or only has placeholders ("New process", "First stage", "Requester", "It starts").
2) set_meta with title, a one-line summary, a 2-3 sentence plain-English nutshell, audience, 1-4 triggers and 2-4 outcomes.
3) 3-6 roles that really take part.
4) 4-6 stages in order, each with title, short, place, one-sentence text, and systems/docs where relevant.
5) In each stage 2-4 steps done by the right role; one "start" step first (kind start) and one "end" step last (kind end); at least one decision where a check or approval happens.
6) Chain every step with "after". Keep it under ~60 ops.`

/** Compact outline of the process — a few hundred tokens even for big processes. */
export function outline(p: Process, maxSteps = 80) {
  const roles = p.roles.map((r) => `${r.id}=${r.name}`).join('; ')
  const stages = p.stages.map((s, i) => `${s.id}(${i + 1})=${s.short}${s.systems.length ? ` [sys: ${s.systems.join(', ')}]` : ''}`).join('; ')
  const steps = p.steps.slice(0, maxSteps).map((s) => `${s.id}|${s.kind}|${s.label}|${s.roleId}|${s.stageId}${s.resourceIds?.length ? `|uses:${s.resourceIds.join(',')}` : ''}`).join('\n')
  const edges = p.edges.slice(0, maxSteps * 2).map((e) => `${e.from}>${e.to}${e.label ? `:${e.label}` : ''}`).join(' ')
  return `PROCESS: ${p.title}\nSUMMARY: ${p.summary.slice(0, 240)}\nTRIGGERS: ${p.triggers.join('; ')}\nOUTCOMES: ${p.outcomes.join('; ')}\nROLES: ${roles}\nSTAGES: ${stages}\nSTEPS (id|kind|label|role|stage):\n${steps}\nLINKS: ${edges}`
}

/** Older messages are folded into a short local summary (no extra API call, saves quota). */
export function foldHistory(history: ChatMsg[], prevSummary: string) {
  if (history.length <= KEEP_MESSAGES) return { recent: history, summary: prevSummary }
  const old = history.slice(0, history.length - KEEP_MESSAGES)
  const asks = old.filter((m) => m.role === 'user').map((m) => '- ' + m.content.replace(/\s+/g, ' ').slice(0, 140)).join('\n')
  const summary = [prevSummary, asks].filter(Boolean).join('\n').split('\n').slice(-12).join('\n')
  return { recent: history.slice(-KEEP_MESSAGES), summary }
}

export function buildMessages(p: Process, history: ChatMsg[], summary: string, build = false, library: LibraryItem[] = [], systems: InternalSystem[] = []) {
  let maxSteps = 80
  let recent = history
  const make = () => {
    const ctx = `${outline(p, maxSteps)}${summary ? `\nEARLIER REQUESTS (summary):\n${summary}` : ''}${library.length ? `\nLIBRARY (id|category|title):\n${libraryOutline(library.slice(0, maxSteps))}` : ''}`
    return [
      { role: 'system', content: SYSTEM },
      { role: 'system', content: ctx + (systems.length ? `\nINTERNAL SYSTEMS: ${systems.map((x) => x.name).join('; ')}` : '') },
      ...(build ? [{ role: 'system', content: BUILD_HINT }] : []),
      ...recent.map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
    ]
  }
  let msgs = make()
  const size = () => msgs.reduce((a, m) => a + estTokens(m.content) + 4, 0)
  // trim until it fits the budget: shorter outline first, then fewer messages
  while (size() > INPUT_BUDGET && maxSteps > 20) { maxSteps -= 20; msgs = make() }
  while (size() > INPUT_BUDGET && recent.length > 1) { recent = recent.slice(1); msgs = make() }
  return { messages: msgs, tokens: size() }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class GroqError extends Error {
  status?: number
  constructor(msg: string, status?: number) { super(msg); this.status = status }
}

async function callGroq(key: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
  const body = JSON.stringify(payload)
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(GROQ_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body, signal })
    if (res.status === 429 && attempt === 0) {
      const ra = Number(res.headers.get('retry-after')) || Number((await res.text()).match(/try again in ([\d.]+)s/)?.[1]) || 8
      await sleep(Math.min(ra, 30) * 1000 + 300)
      continue
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      const msg = res.status === 401 ? 'The Groq key was rejected. Ask your Global Admin to check it.'
        : res.status === 429 ? 'Groq is busy (rate limit reached). Wait a minute and try again.'
        : res.status === 413 ? 'That request was too big. Try a shorter message.'
        : `Groq error ${res.status}: ${t.slice(0, 160)}`
      throw new GroqError(msg, res.status)
    }
    const data = await res.json()
    return { text: data?.choices?.[0]?.message?.content ?? '', truncated: data?.choices?.[0]?.finish_reason === 'length' }
  }
  throw new GroqError('Groq is busy (rate limit reached). Wait a minute and try again.', 429)
}

const tuning = (model: string): Record<string, unknown> => {
  // reasoning models spend output tokens "thinking" — keep that short so the answer isn't cut off
  if (/gpt-oss/i.test(model)) return { reasoning_effort: 'low' }
  if (/qwen|deepseek/i.test(model)) return { reasoning_format: 'hidden' }
  return {}
}

export interface AskResult { reply: string; ops: Op[]; spec?: BuildSpec; tokens: number; summary: string; truncated: boolean; gaps?: string[] }

export interface BuildOpts { key: string; model: string; process: Process; history: ChatMsg[]; summary: string; library?: LibraryItem[]; systems?: InternalSystem[]; signal?: AbortSignal
  /** build a whole process from this request (+ the owner's answers), skipping the edit-ops mode */
  build?: { request: string; answers?: string }
}

export async function askGroq(opts: BuildOpts): Promise<AskResult> {
  const { recent, summary } = foldHistory(opts.history, opts.summary)
  const last = recent[recent.length - 1]?.content ?? ''
  if (opts.build) return buildWhole(opts, opts.build.request, summary, opts.build.answers)
  if (isBuildRequest(last, opts.process)) return buildWhole(opts, last, summary)
  const { messages, tokens } = buildMessages(opts.process, recent, summary, false, opts.library, opts.systems)
  const { text, truncated } = await callGroq(opts.key, { model: opts.model, messages, temperature: 0.2, max_tokens: MAX_OUTPUT, response_format: { type: 'json_object' }, ...tuning(opts.model) }, opts.signal)
  const json = parseJson(text)
  return { reply: String(json.reply ?? (truncated ? 'Here is what I managed before running out of room.' : 'Done.')), ops: Array.isArray(json.ops) ? json.ops : [], tokens, summary, truncated }
}

/** Whole-process build: one nested outline, checked for detail, with one automatic "make it fuller" retry. */
async function buildWhole(opts: { key: string; model: string; library?: LibraryItem[]; systems?: InternalSystem[]; signal?: AbortSignal }, request: string, summary: string, answers?: string): Promise<AskResult> {
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: BUILD_SYSTEM },
    ...(opts.systems?.length ? [{ role: 'system', content: `INTERNAL SYSTEMS (name — what it is for):\n${systemsList(opts.systems)}` }] : []),
    ...(opts.library?.length ? [{ role: 'system', content: `LIBRARY (id|category|title):\n${libraryOutline(opts.library.slice(0, 120))}` }] : []),
    ...(summary ? [{ role: 'system', content: `Earlier requests in this chat:\n${summary}` }] : []),
    { role: 'user', content: request.slice(0, 2000) + (answers ? `\n\nOWNER'S ANSWERS:\n${answers.slice(0, 2500)}` : '') },
  ]
  const ask = () => callGroq(opts.key, { model: opts.model, messages, temperature: 0.3, max_tokens: MAX_OUTPUT_BUILD, response_format: { type: 'json_object' }, ...tuning(opts.model) }, opts.signal)
  let { text, truncated } = await ask()
  let json = parseBuild(text)
  let stats = specStats(json.process)
  let gaps = edgeGaps(json.process)
  if (!stats.ok || gaps.length) {
    // too thin, cut off, or edge cases missing — ask once more, saying exactly what to fix (one retry keeps us inside the rate limit)
    const why = [
      ...(!stats.ok ? [`not detailed enough (${stats.stages} stages, ${stats.steps} steps) — use 5-7 stages with 3-5 steps each`] : []),
      ...gaps,
    ]
    messages.push({ role: 'assistant', content: text.slice(0, 3000) })
    messages.push({ role: 'user', content: `Improve it. Problems:\n- ${why.join('\n- ')}\nReturn the COMPLETE process again in the same JSON shape, keeping everything that was good. Keep step labels short so it fits.` })
    const second = await ask()
    const j2 = parseBuild(second.text)
    const s2 = specStats(j2.process), g2 = edgeGaps(j2.process)
    const better = s2.ok && (g2.length < gaps.length || s2.steps > stats.steps) || (!stats.ok && s2.steps > stats.steps)
    if (better) { json = j2; text = second.text; truncated = second.truncated; stats = s2; gaps = g2 }
  }
  const tokens = messages.reduce((a, m) => a + estTokens(m.content) + 4, 0)
  if (!json.process || !stats.steps) return { reply: json.reply || "I couldn't build that one — try describing who does what, in a sentence or two.", ops: [], tokens, summary, truncated }
  return { reply: json.reply || `Here's the full process: ${stats.stages} stages and ${stats.steps} steps.`, ops: [], spec: json.process, tokens, summary, truncated, gaps }
}

/* ---------- questions before building ---------- */
export interface Question { q: string; why?: string; options: string[]; multi?: boolean }

const CLARIFY_SYSTEM = `You help a process owner design a business process. BEFORE anything is built, ask the few questions whose answers change the design most.
Ask 3 to 5 short questions in plain, friendly English. Each has 2-6 short answer options the owner can tap (they can also type their own).
Cover, when the request doesn't already say:
1) WHICH INTERNAL SYSTEMS are used for the key parts (e.g. where records are kept, where it is approved, how people are told). Use the exact names from INTERNAL SYSTEMS as options; add "Something else" when unsure. Set "multi": true.
2) WHO approves or signs off, and whether anything needs a second check.
3) The EDGE CASES that matter most for THIS process — e.g. what happens if nobody responds in time, if it is rejected, if information is missing, if consent is withdrawn, if an AI step gets it wrong, if it is urgent. Offer realistic handling options.
4) Rules that apply (privacy, consent, NDIS or other standards, record keeping) only if relevant.
Don't ask what the request already answers. Don't ask more than 5.
Reply ONLY with JSON: {"reply":"<one friendly sentence, e.g. 'A few quick questions so I get your systems and the tricky cases right:'>","questions":[{"q":"","why":"<few words: why it matters>","options":["",""],"multi":false}]}`

export async function clarifyBuild(opts: { key: string; model: string; request: string; systems?: InternalSystem[]; library?: LibraryItem[]; signal?: AbortSignal }): Promise<{ reply: string; questions: Question[] }> {
  const lib = (opts.library ?? []).filter((x) => x.category === 'policy' || x.category === 'process').map((x) => x.title).join('; ')
  const { text } = await callGroq(opts.key, {
    model: opts.model, temperature: 0.3, max_tokens: 1200, response_format: { type: 'json_object' }, ...tuning(opts.model),
    messages: [
      { role: 'system', content: CLARIFY_SYSTEM },
      { role: 'system', content: `INTERNAL SYSTEMS (name — what it is for):\n${systemsList(opts.systems) || '(none listed yet)'}${lib ? `\nPOLICIES & PROCESSES IN THE LIBRARY: ${lib}` : ''}` },
      { role: 'user', content: opts.request.slice(0, 2000) },
    ],
  }, opts.signal)
  const j = parseBuild(text) as { reply?: string; questions?: Question[] }
  const questions = (Array.isArray(j.questions) ? j.questions : [])
    .filter((x) => x && typeof x.q === 'string' && x.q.trim())
    .map((x) => ({ q: x.q.trim(), why: x.why, multi: !!x.multi, options: (Array.isArray(x.options) ? x.options : []).map(String).filter(Boolean).slice(0, 6) }))
    .slice(0, 5)
  return { reply: j.reply || 'A few quick questions first:', questions }
}

function parseBuild(t: string): { reply?: string; process?: BuildSpec } {
  try { return JSON.parse(t) } catch { /* fall through */ }
  const m = t.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* ignore */ } }
  return {}
}

function parseJson(t: string): { reply?: string; ops?: Op[] } {
  try { return JSON.parse(t) } catch { /* fall through */ }
  const m = t.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* ignore */ } }
  // cut-off reply: keep every complete op object we can find
  const reply = t.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
  const ops: Op[] = []
  const arr = t.indexOf('"ops"')
  if (arr >= 0) {
    let depth = 0, startIdx = -1
    for (let i = t.indexOf('[', arr) + 1; i > 0 && i < t.length; i++) {
      const c = t[i]
      if (c === '{') { if (depth === 0) startIdx = i; depth++ }
      else if (c === '}') { depth--; if (depth === 0 && startIdx >= 0) { try { ops.push(JSON.parse(t.slice(startIdx, i + 1))) } catch { /* skip */ } startIdx = -1 } }
    }
  }
  return { reply: reply ?? (ops.length ? 'Here is a first version.' : t.slice(0, 400)), ops }
}

export async function testGroq(key: string, model: string) {
  const res = await fetch(GROQ_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 5 }) })
  if (!res.ok) throw new GroqError(res.status === 401 ? 'Key rejected' : `Error ${res.status}`, res.status)
  return true
}

/* ---------- "Ask about this process" (read-only Q&A for anyone) ---------- */
const ASK_SYSTEM = `You answer questions from staff about ONE business process, using only the facts below.
Write for a non-technical person: short, friendly, plain words, no jargon (explain any acronym). 1-4 sentences, or a short list if steps are asked for.
If the facts don't say, answer "The process doesn't say — ask the process owner, OWNER." Never invent people, systems or rules.
Reply ONLY with JSON: {"answer": string, "stage": number|null}  — stage = the 1-based stage the answer is mostly about, or null.`

export function aboutFacts(p: Process, lib: LibraryItem[]) {
  const title = (id: string) => lib.find((x) => x.id === id)?.title ?? id
  const stages = p.stages.map((s, i) => {
    const steps = p.steps.filter((x) => x.stageId === s.id && (x.kind === 'step' || x.kind === 'decision')).map((x) => {
      const role = p.roles.find((r) => r.id === x.roleId)?.name ?? ''
      const no = x.kind === 'decision' ? p.edges.find((e) => e.from === x.id && /^no$/i.test(e.label ?? '')) : undefined
      const back = no ? ` (if no: back to "${p.steps.find((y) => y.id === no.to)?.label}")` : ''
      const uses = x.resourceIds?.length ? ` [uses: ${x.resourceIds.map(title).join(', ')}]` : ''
      return `  - ${x.kind === 'decision' ? 'CHECK: ' : ''}${x.label} — ${role}${back}${uses}`
    }).join('\n')
    return `STAGE ${i + 1}: ${s.title} (at ${s.place})${s.systems.length ? ` · systems: ${s.systems.join(', ')}` : ''}\n  ${s.text}\n${steps}`
  }).join('\n')
  const roles = p.roles.map((r) => `${r.name}${r.tools?.length ? ` (AI agent; tools: ${r.tools.join(', ')})` : ''}`).join('; ')
  const linked = (p.linkedIds ?? []).map(title).join('; ')
  return `PROCESS: ${p.title}\nOWNER: ${p.owner}\nSUMMARY: ${p.summary}\nIN A NUTSHELL: ${p.nutshell}\nSTARTS WHEN: ${p.triggers.join('; ')}\nDONE WHEN: ${p.outcomes.join('; ')}\nROLES: ${roles}\n${stages}${linked ? `\nPOLICIES & RELATED: ${linked}` : ''}${p.exceptions?.length ? `\nWHAT IF: ${p.exceptions.map((x) => `${x.case} → ${x.handled}`).join('; ')}` : ''}`.slice(0, 14000)
}

export async function askAbout(opts: { key: string; model: string; process: Process; library: LibraryItem[]; history: ChatMsg[]; question: string; signal?: AbortSignal }) {
  const facts = aboutFacts(opts.process, opts.library)
  // keep within budget: facts + the last few turns
  const hist: ChatMsg[] = []
  let used = estTokens(facts) + estTokens(opts.question) + 300
  for (const m of [...opts.history].reverse().slice(0, 4)) { const t = estTokens(m.content); if (used + t > INPUT_BUDGET) break; used += t; hist.unshift(m) }
  const { text } = await callGroq(opts.key, {
    model: opts.model, temperature: 0.2, max_tokens: 700, response_format: { type: 'json_object' }, ...tuning(opts.model),
    messages: [{ role: 'system', content: ASK_SYSTEM.replace('OWNER', opts.process.owner) + '\n\nFACTS:\n' + facts }, ...hist, { role: 'user', content: opts.question }],
  }, opts.signal)
  try {
    const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    const st = Number(j.stage)
    return { answer: String(j.answer ?? '').trim() || 'Sorry, I could not find an answer.', stage: Number.isFinite(st) && st >= 1 && st <= opts.process.stages.length ? st : null }
  } catch { return { answer: text.trim() || 'Sorry, I could not find an answer.', stage: null } }
}
