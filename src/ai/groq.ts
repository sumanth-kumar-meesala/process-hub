import type { Process } from '@/lib/types'
import type { Op } from './ops'

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
const MAX_OUTPUT = 1200

export interface ChatMsg { role: 'user' | 'assistant'; content: string }

/** Rough token estimate (≈4 characters per token for English). */
export const estTokens = (s: string) => Math.ceil(s.length / 4)

const SYSTEM = `You help non-technical staff build business processes for "Process Hub".
Write in plain, friendly English (no jargon like BPMN, swimlane, gateway).
A process has ROLES (who), STAGES (big phases, shown as 3D islands), STEPS inside a stage done by one role, DECISIONS (yes/no questions), connections between steps, TRIGGERS (what starts it) and OUTCOMES (how you know it's done).
Reply ONLY with JSON: {"reply": "<one or two short sentences to the user>", "ops": [ ... ]}
Allowed ops (refer to roles/stages/steps by the ids or names in the outline):
{"op":"add_role","name":""}
{"op":"rename_role","role":"","name":""}
{"op":"add_stage","title":"","short":"<2-3 words>","place":"","text":"<one plain sentence>","systems":[],"docs":[]}
{"op":"update_stage","stage":"","title":"","short":"","place":"","text":"","systems":[],"docs":[]}
{"op":"add_step","id":"<short new id>","label":"<verb first, max 5 words>","role":"","stage":"","kind":"step|decision|start|end","after":"<step id to insert after>"}
{"op":"update_step","step":"","label":"","role":"","stage":""}
{"op":"remove_step","step":""}
{"op":"connect","from":"","to":"","label":"Yes|No|"}
{"op":"disconnect","from":"","to":""}
{"op":"set_meta","title":"","summary":"","nutshell":"","audience":"","triggers":[],"outcomes":[]}
Rules: add stages before steps that use them. Keep labels short. Never invent systems, documents or policy names the user did not mention. If the request is unclear, ask one question in "reply" and return "ops": [].`

/** Compact outline of the process — a few hundred tokens even for big processes. */
export function outline(p: Process, maxSteps = 80) {
  const roles = p.roles.map((r) => `${r.id}=${r.name}`).join('; ')
  const stages = p.stages.map((s, i) => `${s.id}(${i + 1})=${s.short}${s.systems.length ? ` [sys: ${s.systems.join(', ')}]` : ''}`).join('; ')
  const steps = p.steps.slice(0, maxSteps).map((s) => `${s.id}|${s.kind}|${s.label}|${s.roleId}|${s.stageId}`).join('\n')
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

export function buildMessages(p: Process, history: ChatMsg[], summary: string) {
  let maxSteps = 80
  let recent = history
  const make = () => {
    const ctx = `${outline(p, maxSteps)}${summary ? `\nEARLIER REQUESTS (summary):\n${summary}` : ''}`
    return [
      { role: 'system', content: SYSTEM },
      { role: 'system', content: ctx },
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

export async function askGroq(opts: { key: string; model: string; process: Process; history: ChatMsg[]; summary: string; signal?: AbortSignal }): Promise<{ reply: string; ops: Op[]; tokens: number; summary: string }> {
  const { recent, summary } = foldHistory(opts.history, opts.summary)
  const { messages, tokens } = buildMessages(opts.process, recent, summary)
  const body = JSON.stringify({ model: opts.model, messages, temperature: 0.2, max_tokens: MAX_OUTPUT, response_format: { type: 'json_object' } })
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(GROQ_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.key}` }, body, signal: opts.signal })
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
    const text: string = data?.choices?.[0]?.message?.content ?? ''
    const json = parseJson(text)
    return { reply: String(json.reply ?? 'Done.'), ops: Array.isArray(json.ops) ? json.ops : [], tokens, summary }
  }
  throw new GroqError('Groq is busy (rate limit reached). Wait a minute and try again.', 429)
}

function parseJson(t: string): { reply?: string; ops?: Op[] } {
  try { return JSON.parse(t) } catch { /* fall through */ }
  const m = t.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* ignore */ } }
  return { reply: t.slice(0, 400), ops: [] }
}

export async function testGroq(key: string, model: string) {
  const res = await fetch(GROQ_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 5 }) })
  if (!res.ok) throw new GroqError(res.status === 401 ? 'Key rejected' : `Error ${res.status}`, res.status)
  return true
}
