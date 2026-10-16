import type { LibraryItem, Process } from '@/lib/types'
import type { Op } from './ops'
import { BUILD_SYSTEM, specStats, type BuildSpec } from './build'
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
- If the request is unclear, ask one question in "reply" and return "ops": [].`

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

export function buildMessages(p: Process, history: ChatMsg[], summary: string, build = false, library: LibraryItem[] = []) {
  let maxSteps = 80
  let recent = history
  const make = () => {
    const ctx = `${outline(p, maxSteps)}${summary ? `\nEARLIER REQUESTS (summary):\n${summary}` : ''}${library.length ? `\nLIBRARY (id|category|title):\n${libraryOutline(library.slice(0, maxSteps))}` : ''}`
    return [
      { role: 'system', content: SYSTEM },
      { role: 'system', content: ctx },
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

export interface AskResult { reply: string; ops: Op[]; spec?: BuildSpec; tokens: number; summary: string; truncated: boolean }

export async function askGroq(opts: { key: string; model: string; process: Process; history: ChatMsg[]; summary: string; library?: LibraryItem[]; signal?: AbortSignal }): Promise<AskResult> {
  const { recent, summary } = foldHistory(opts.history, opts.summary)
  const last = recent[recent.length - 1]?.content ?? ''
  if (isBuildRequest(last, opts.process)) return buildWhole(opts, last, summary)
  const { messages, tokens } = buildMessages(opts.process, recent, summary, false, opts.library)
  const { text, truncated } = await callGroq(opts.key, { model: opts.model, messages, temperature: 0.2, max_tokens: MAX_OUTPUT, response_format: { type: 'json_object' }, ...tuning(opts.model) }, opts.signal)
  const json = parseJson(text)
  return { reply: String(json.reply ?? (truncated ? 'Here is what I managed before running out of room.' : 'Done.')), ops: Array.isArray(json.ops) ? json.ops : [], tokens, summary, truncated }
}

/** Whole-process build: one nested outline, checked for detail, with one automatic "make it fuller" retry. */
async function buildWhole(opts: { key: string; model: string; library?: LibraryItem[]; signal?: AbortSignal }, request: string, summary: string): Promise<AskResult> {
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: BUILD_SYSTEM },
    ...(opts.library?.length ? [{ role: 'system', content: `LIBRARY (id|category|title):\n${libraryOutline(opts.library.slice(0, 120))}` }] : []),
    ...(summary ? [{ role: 'system', content: `Earlier requests in this chat:\n${summary}` }] : []),
    { role: 'user', content: request.slice(0, 2000) },
  ]
  const ask = () => callGroq(opts.key, { model: opts.model, messages, temperature: 0.3, max_tokens: MAX_OUTPUT_BUILD, response_format: { type: 'json_object' }, ...tuning(opts.model) }, opts.signal)
  let { text, truncated } = await ask()
  let json = parseBuild(text)
  let stats = specStats(json.process)
  if (!stats.ok) {
    // too thin (or cut off) — ask once more, telling the model exactly what was missing
    messages.push({ role: 'assistant', content: text.slice(0, 3000) })
    messages.push({ role: 'user', content: `That is not detailed enough (${stats.stages} stages, ${stats.steps} steps). Return the COMPLETE process again in the same JSON shape with 5-7 stages, 3-5 steps in each stage, all roles, and at least 2 decisions. Keep step labels short so it fits.` })
    const second = await ask()
    const j2 = parseBuild(second.text)
    if (specStats(j2.process).steps > stats.steps) { json = j2; text = second.text; truncated = second.truncated; stats = specStats(j2.process) }
  }
  const tokens = messages.reduce((a, m) => a + estTokens(m.content) + 4, 0)
  if (!json.process || !stats.steps) return { reply: json.reply || "I couldn't build that one — try describing who does what, in a sentence or two.", ops: [], tokens, summary, truncated }
  return { reply: json.reply || `Here's the full process: ${stats.stages} stages and ${stats.steps} steps.`, ops: [], spec: json.process, tokens, summary, truncated }
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
