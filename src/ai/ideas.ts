import { callGroq, tuning } from './groq'
import { ideasBrief, type Idea } from '@/lib/ideas'
import { uid, type Process } from '@/lib/types'

const SYSTEM = `You are a sharp product strategist. From the organisation's real business processes below, find NEW product or service ideas that solve real problems people would PAY for.
Rules:
- Every idea must come from evidence in the processes: rework loops, hand-offs, waiting, manual evidence, unconnected systems, risky checks, AI steps needing review, money steps. Name the process ids and the exact steps.
- Prefer ideas that work across several processes or organisations (bigger market).
- Be genuinely novel: not "use a CRM", "add a dashboard" or "digitise forms" unless there is a clear new twist. Say what is new.
- Be honest with scores (1-5): pain = how much it hurts today, novelty = how new it is, pay = how likely someone pays and how much.
- Plain English, no jargon. Short sentences.
Reply ONLY with JSON: {"ideas":[{"title":"<max 6 words>","problem":"<1-2 sentences>","solution":"<1-2 sentences>","whoPays":"<the buyer>","whyPay":"<the value in money/time/risk>","price":"<pricing model>","novelty":"<what is new>","sources":[{"processId":"<id>","label":"<step or pattern>"}],"scores":{"pain":1,"novelty":1,"pay":1}}]}
Give exactly 6 ideas, best first.`

export async function findIdeas(opts: { key: string; model: string; processes: Process[]; existing: Idea[]; signal?: AbortSignal }): Promise<Idea[]> {
  const avoid = opts.existing.slice(0, 30).map((i) => i.title).join('; ')
  const { text } = await callGroq(opts.key, {
    model: opts.model, temperature: 0.7, max_tokens: 3000, response_format: { type: 'json_object' }, ...tuning(opts.model),
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `PROCESSES:\n${ideasBrief(opts.processes)}${avoid ? `\n\nALREADY HAVE (don't repeat): ${avoid}` : ''}` },
    ],
  }, opts.signal)
  let j: { ideas?: Partial<Idea>[] } = {}
  try { j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) } catch { /* empty */ }
  const ids = new Set(opts.processes.map((p) => p.id))
  const n = (x: unknown) => Math.max(1, Math.min(5, Math.round(Number(x) || 3)))
  const now = new Date().toISOString()
  return (j.ideas ?? []).filter((i) => i?.title && i.problem).slice(0, 8).map((i) => ({
    id: uid('idea'),
    title: String(i.title).trim(), problem: String(i.problem).trim(), solution: String(i.solution ?? '').trim(),
    whoPays: String(i.whoPays ?? '').trim(), whyPay: String(i.whyPay ?? '').trim(), price: String(i.price ?? '').trim(), novelty: String(i.novelty ?? '').trim(),
    sources: (Array.isArray(i.sources) ? i.sources : []).filter((s) => s && ids.has(String(s.processId))).map((s) => ({ processId: String(s.processId), label: String(s.label ?? '') })).slice(0, 5),
    scores: { pain: n(i.scores?.pain), novelty: n(i.scores?.novelty), pay: n(i.scores?.pay) },
    origin: 'ai' as const, status: 'new' as const, votes: 0, createdAt: now,
  }))
}
