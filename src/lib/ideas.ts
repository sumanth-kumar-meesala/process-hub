import type { Process, Step } from './types'
import { roleKind, sysLabel, sysUnsure } from './derive'
import { usualPath } from './walk'
import { uid } from './types'

/** An idea that solves a real problem in one or more processes — and that someone would pay for. */
export interface Idea {
  id: string
  title: string
  /** the problem, in plain words */
  problem: string
  /** what the product or service does */
  solution: string
  whoPays: string
  whyPay: string
  price: string
  /** why it's new — what's different from what exists */
  novelty: string
  /** where the problem shows up */
  sources: { processId: string; label: string }[]
  /** 1-5 each */
  scores: { pain: number; novelty: number; pay: number }
  origin: 'ai' | 'scan' | 'mine'
  status: 'new' | 'shortlist' | 'dropped'
  votes: number
  createdAt: string
}

export const ideaScore = (i: Idea) => i.scores.pain + i.scores.novelty + i.scores.pay
const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)))
const work = (s: Step) => s.kind === 'step' || s.kind === 'decision'

/** The facts about a process that point to problems worth solving. */
export function signalsOf(p: Process) {
  const by = (id?: string) => p.steps.find((x) => x.id === id)
  const order = (id: string) => p.steps.findIndex((x) => x.id === id)
  const rework = p.steps.filter((s) => s.kind === 'decision').map((d) => {
    const no = p.edges.find((e) => e.from === d.id && /^no$/i.test(e.label ?? ''))
    const to = no && by(no.to)
    return to && order(to.id) < order(d.id) ? { check: d, back: to } : null
  }).filter(Boolean) as { check: Step; back: Step }[]
  const path = usualPath(p)
  let handoffs = 0
  path.forEach((s, i) => { if (i && s.roleId !== path[i - 1].roleId) handoffs++ })
  const systems = [...new Set(p.stages.flatMap((s) => s.systems))]
  const unknownSystems = systems.filter(sysUnsure).map(sysLabel)
  const agents = p.roles.filter((r) => roleKind(r) === 'agent')
  const waits = (p.exceptions ?? []).filter((x) => /(in time|respond|reply|chase|remind|no answer|decid|late|on time)/i.test(`${x.case} ${x.handled}`))
  const evidence = p.steps.filter((s) => work(s) && /(evidence|record|declare|compliance|audit|ndis|certificate|file)/i.test(s.label))
  const money = p.steps.filter((s) => work(s) && /(pay|invoice|budget|funding|bank|final pay|payroll)/i.test(s.label))
  return { rework, handoffs, steps: path.length, systems: systems.map(sysLabel), unknownSystems, agents, waits, evidence, money }
}

/**
 * Finds ideas without AI, from patterns in the processes: work that bounces back, hand-offs,
 * people chasing replies, evidence gathered by hand, systems nobody connected, AI that needs checking.
 * The same pattern across several processes makes one stronger idea.
 */
export function scanIdeas(processes: Process[]): Idea[] {
  const now = new Date().toISOString()
  const live = processes.filter((p) => p.steps.some(work))
  const bucket = new Map<string, Idea>()
  const add = (key: string, make: () => Omit<Idea, 'id' | 'origin' | 'status' | 'votes' | 'createdAt' | 'sources' | 'scores'>, src: { processId: string; label: string }, scores: Idea['scores']) => {
    const cur = bucket.get(key)
    if (cur) {
      cur.sources.push(src)
      // the same problem in more processes: more pain, more people who'd pay
      cur.scores = { pain: clamp(Math.max(cur.scores.pain, scores.pain) + 0.5), novelty: cur.scores.novelty, pay: clamp(cur.scores.pay + 0.5) }
      return
    }
    bucket.set(key, { id: uid('idea'), ...make(), sources: [src], scores, origin: 'scan', status: 'new', votes: 0, createdAt: now })
  }
  live.forEach((p) => {
    const s = signalsOf(p)
    const name = p.code ? `${p.code} ${p.title}` : p.title
    s.rework.forEach(({ check, back }) => add('rework', () => ({
      title: 'Right-first-time checker',
      problem: `Work bounces back when a check says no — e.g. “${check.label}” sends it back to “${back.label}”. Every bounce costs days and a second round of effort.`,
      solution: 'Before work is handed on, an assistant checks it against what the reviewer will look for (rules, missing fields, past rejections) and flags gaps to fix first.',
      whoPays: 'The process owner / operations manager',
      whyPay: 'Fewer rejections means faster turnaround and less rework — easy to measure as “bounces per month”.',
      price: 'Per user per month, or per check run',
      novelty: "Learns from this organisation's own past rejections instead of a generic checklist.",
    }), { processId: p.id, label: `${name}: ${check.label}` }, { pain: clamp(2 + s.rework.length * 0.7), novelty: 4, pay: 4 }))
    if (s.handoffs >= 4) add('handoffs', () => ({
      title: 'Hand-off radar',
      problem: `The work changes hands ${s.handoffs} times between people and teams. Nobody can see where it is, so people chase each other.`,
      solution: 'One live status for every case: who has it now, how long it has waited, and an automatic nudge when it stalls. Built from the process map, so no set-up.',
      whoPays: 'Team leaders and the people waiting on the outcome',
      whyPay: 'Cuts chasing emails and missed deadlines; shows where work gets stuck.',
      price: 'Per active case, or a team subscription',
      novelty: 'Generated straight from the process map instead of configuring a workflow tool.',
    }), { processId: p.id, label: `${name}: ${s.handoffs} hand-offs` }, { pain: clamp(1 + s.handoffs / 3), novelty: 3, pay: 3 })
    s.waits.forEach((x) => add('waits', () => ({
      title: 'Auto-chaser with escalation',
      problem: `Things stall waiting for a reply — “${x.case}”. Today a person has to notice and chase.`,
      solution: 'Sends polite reminders at the right time, escalates to the named person when the deadline passes, and records it all.',
      whoPays: 'HR, operations and compliance teams',
      whyPay: 'Removes manual chasing and gives proof that deadlines were met.',
      price: 'Per user per month',
      novelty: 'Deadlines and escalation paths come from the process itself.',
    }), { processId: p.id, label: `${name}: ${x.case}` }, { pain: 4, novelty: 2, pay: 4 }))
    if (s.evidence.length >= 2) add('evidence', () => ({
      title: 'Audit-ready evidence pack',
      problem: `Evidence is recorded step by step (${s.evidence.slice(0, 3).map((e) => `“${e.label}”`).join(', ')}) and pulled together by hand when an audit comes.`,
      solution: 'Collects the evidence as each step is done and produces a ready-to-send pack per client, worker or case — with gaps highlighted.',
      whoPays: 'Quality and compliance managers (e.g. for NDIS audits)',
      whyPay: 'Audit prep goes from days to minutes; missing evidence is caught early, not at audit time.',
      price: 'Per organisation per year, by size',
      novelty: 'Maps each piece of evidence to the exact step and standard it proves.',
    }), { processId: p.id, label: `${name}: ${s.evidence.length} evidence steps` }, { pain: clamp(2 + s.evidence.length / 2), novelty: 3, pay: 5 })
    if (s.unknownSystems.length) add('systems', () => ({
      title: 'No-code connector for the gaps',
      problem: `Some steps rely on systems that aren't connected or even agreed yet (${s.unknownSystems.join(', ')}), so people re-type the same information.`,
      solution: 'A small connector that moves the data between the systems each step uses, set up from the process map.',
      whoPays: 'IT and operations',
      whyPay: 'Less double entry and fewer typing errors.',
      price: 'Per connection per month',
      novelty: 'Knows which data each step needs because it reads the process.',
    }), { processId: p.id, label: `${name}: ${s.unknownSystems.join(', ')}` }, { pain: 3, novelty: 2, pay: 3 })
    s.agents.forEach((a) => add('agent-review', () => ({
      title: 'Only-check-what-matters for AI work',
      problem: `${a.name} does work that a person then reviews in full every time — so the AI saves less time than it should.`,
      solution: 'The AI marks how sure it is, highlights the parts that changed or look risky, and people only review those.',
      whoPays: 'Teams already using AI in their process',
      whyPay: 'Keeps a human in charge while cutting review time sharply.',
      price: 'Per item reviewed',
      novelty: 'Review effort follows the AI’s own confidence instead of checking everything.',
    }), { processId: p.id, label: `${name}: ${a.name}` }, { pain: 3, novelty: 4, pay: 4 }))
    if (s.money.length >= 2) add('money', () => ({
      title: 'Payment mistake catcher',
      problem: `Money steps (${s.money.slice(0, 3).map((m) => `“${m.label}”`).join(', ')}) are checked by hand, and mistakes or fraud are expensive.`,
      solution: 'Checks each payment against the order, receipt, policy and past patterns, and stops anything unusual before it goes out.',
      whoPays: 'Finance teams',
      whyPay: 'One prevented wrong payment can pay for a year.',
      price: 'Per transaction checked, or % of savings',
      novelty: 'Uses the process rules (approval limits, matching) as well as patterns.',
    }), { processId: p.id, label: `${name}: ${s.money.length} money steps` }, { pain: 4, novelty: 3, pay: 5 })
  })
  return [...bucket.values()].sort((a, b) => ideaScore(b) - ideaScore(a))
}

/** Compact text about the processes for the AI (kept small for Groq's limits). */
export function ideasBrief(processes: Process[], maxChars = 9000) {
  return processes.filter((p) => p.steps.some(work)).map((p) => {
    const s = signalsOf(p)
    return [
      `PROCESS ${p.id}: ${p.title} (${p.area})`,
      `roles: ${p.roles.map((r) => r.name + (roleKind(r) === 'agent' ? ' [AI]' : '')).join(', ')}`,
      `usual path: ${s.steps} steps, ${s.handoffs} hand-offs`,
      `steps: ${p.steps.filter(work).map((x) => x.label).join(' | ')}`,
      s.rework.length ? `rework loops: ${s.rework.map((r) => `${r.check.label} → back to ${r.back.label}`).join('; ')}` : '',
      `systems: ${s.systems.join(', ') || '—'}${s.unknownSystems.length ? ` (not agreed yet: ${s.unknownSystems.join(', ')})` : ''}`,
      p.exceptions?.length ? `what can go wrong: ${p.exceptions.map((x) => x.case).join('; ')}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n').slice(0, maxChars)
}
