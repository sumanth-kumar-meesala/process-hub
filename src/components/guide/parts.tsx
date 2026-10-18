import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, Loader2, Send } from 'lucide-react'
import { ResourceLink } from '@/components/process/ResourceLink'
import { askAbout } from '@/ai/groq'
import { useAiKey } from '@/ai/config'
import { catOf } from '@/lib/resources'
import { quickAnswers, type GuideStep } from '@/lib/guide'
import type { Process } from '@/lib/types'
import { useData, useSession } from '@/store/store'
import { cn } from '@/lib/utils'

/** The "What if…?" case from the process that this step handles, if any. */
export function whatIfFor(p: Process, gs: GuideStep) {
  const label = gs.st.label.toLowerCase()
  return (p.exceptions ?? []).find((e) => e.handled.toLowerCase().startsWith(label))?.case
}

/** Copies a link to this step (the guided page with ?step=…). */
export function useCopy() {
  const [copied, setCopied] = useState('')
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(key); setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1800)
  }
  return { copied, copy }
}
export const stepUrl = (stepId: string) => {
  const base = window.location.href.split('?')[0]
  return `${base}?step=${encodeURIComponent(stepId)}`
}

/** One linked document: must-have or nice-to-have, open it, copy its link. */
export function DocRow({ d, usedIn, compact = false }: { d: GuideStep['docs'][number]; usedIn: string[]; compact?: boolean }) {
  const { copied, copy } = useCopy()
  const c = catOf(d.it.category)
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-outline-variant bg-white', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
      <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: c.color }} aria-hidden />
      <span className="flex min-w-0 flex-[1_1_200px] flex-col leading-tight">
        <b className="text-[15px]">{d.it.title}</b>
        <span className="text-xs text-on-surface-variant">{c.one}{usedIn.length ? ` · also used in ${usedIn.slice(0, 2).join(', ')}${usedIn.length > 2 ? ` +${usedIn.length - 2}` : ''}` : ''}</span>
      </span>
      <span className={cn('inline-flex h-6 flex-none items-center rounded-full px-2.5 text-[11px] font-extrabold', d.must ? 'bg-on-surface text-white' : 'border border-outline-variant text-on-surface-variant')}>
        {d.must ? 'Must have' : 'Nice to have'}
      </span>
      <span className="flex flex-none gap-1.5">
        <ResourceLink it={d.it} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-outline-variant bg-white px-3 text-xs font-bold text-on-surface no-underline hover:bg-surface-low"><ExternalLink size={13} />Open</ResourceLink>
        {d.it.url && (
          <button onClick={() => copy(d.it.id, d.it.url!)} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-outline-variant bg-white px-3 text-xs font-bold hover:bg-surface-low">
            {copied === d.it.id ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy link</>}
          </button>
        )}
      </span>
    </div>
  )
}

/** Render with key={step id} so it starts fresh on each step. Quick answers about the step, plus "ask in your own words" (uses the AI when it's switched on). */
export function StepAsk({ proc, gs, className }: { proc: Process; gs: GuideStep; className?: string }) {
  const { model, persona } = useSession()
  const { key } = useAiKey()
  const library = useData((s) => s.library)
  const [pick, setPick] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [ans, setAns] = useState<{ q: string; a: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const qa = quickAnswers(gs)
  const send = async () => {
    const q = text.trim()
    if (!q || busy) return
    setBusy(true); setErr(''); setPick(null)
    try {
      const r = await askAbout({ key, model, process: proc, library, history: [], question: `About the step “${gs.st.label}” (done by ${gs.role?.name ?? 'someone'}): ${q}` })
      setAns({ q, a: r.answer }); setText('')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-2">
        {qa.map((x, i) => (
          <button key={x.q} onClick={() => { setPick(i); setAns(null) }} aria-pressed={pick === i}
            className={cn('h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-bold', pick === i ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant bg-white text-on-surface hover:bg-surface-low')}>{x.q}</button>
        ))}
      </div>
      {pick !== null && <p className="m-0 rounded-2xl bg-surface-low px-4 py-3 text-[15px] leading-relaxed">{qa[pick].a}</p>}
      {ans && <div className="flex flex-col gap-1 rounded-2xl bg-surface-low px-4 py-3 text-[15px] leading-relaxed"><b className="text-[13px] text-on-surface-variant">{ans.q}</b><span className="whitespace-pre-wrap">{ans.a}</span></div>}
      {err && <p className="m-0 rounded-2xl bg-error-container px-4 py-2.5 text-sm text-error">{err}</p>}
      {key ? (
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex min-h-[48px] items-center gap-2 rounded-full border border-outline-variant bg-white pl-4 pr-1.5">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask in your own words…" aria-label="Your question about this step" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" disabled={busy} />
          <button type="submit" aria-label="Ask" disabled={busy || !text.trim()} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-primary text-white disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      ) : (
        <p className="m-0 text-xs text-on-surface-variant">Asking in your own words needs the AI assistant. {persona === 'admin' ? <Link to="/admin">Switch it on in Admin</Link> : 'Your Global Admin can switch it on.'}</p>
      )}
    </div>
  )
}
