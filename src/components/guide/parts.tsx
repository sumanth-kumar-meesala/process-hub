import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { ResourceLink } from '@/components/process/ResourceLink'
import { catOf } from '@/lib/resources'
import type { GuideStep } from '@/lib/guide'
import type { Process } from '@/lib/types'
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
