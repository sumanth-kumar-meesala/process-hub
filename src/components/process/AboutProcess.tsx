import { useState } from 'react'
import { Check, ChevronRight, Flag, MessageCircleQuestion, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Terms } from '@/components/Terms'
import { AskPanel } from '@/components/process/AskPanel'
import { ResourceLink } from '@/components/process/ResourceLink'
import { catOf } from '@/lib/resources'
import type { LibraryItem, Process } from '@/lib/types'
import { useData } from '@/store/store'

const initials = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

/**
 * Under the 3D map and the Timeline (the same on both): only what the steps don't already show —
 * what it's for and who owns it, what starts and ends it, what to do when things go wrong,
 * the rules behind it and related processes, and a place to ask a question.
 */
export function AboutProcess({ proc, onShowStage }: { proc: Process; onShowStage?: (k: number) => void }) {
  const library = useData((s) => s.library)
  const [asking, setAsking] = useState(false)
  const linked = (proc.linkedIds ?? []).map((id) => library.find((x) => x.id === id)).filter(Boolean) as LibraryItem[]
  const policies = linked.filter((x) => x.category === 'policy')
  const related = linked.filter((x) => x.category !== 'policy')
  const cases = proc.exceptions ?? []

  return (
    <section aria-label="About this process" className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 px-3 pb-16 pt-2 sm:px-6 print:hidden">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* what it's for, who owns it, ask */}
        <div className="flex flex-col gap-4 rounded-[28px] bg-white p-6">
          <h2 className="m-0 text-xl font-extrabold">About this process</h2>
          <p className="m-0 text-[16px] leading-relaxed"><Terms text={proc.nutshell || proc.summary} /></p>
          {proc.audience && <p className="m-0 text-sm text-on-surface-variant"><b className="text-on-surface">For:</b> {proc.audience}</p>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-on-surface-variant">
            <Person label="Owner" name={proc.owner} bg="#DFE7FF" fg="#0A2472" />
            {proc.executiveOwner && <Person label="Executive" name={proc.executiveOwner} bg="#D3F2DE" fg="#0B3D20" />}
            {proc.reviewLast && <span>Last reviewed <b className="text-on-surface">{proc.reviewLast}</b></span>}
            {proc.reviewNext && <span>Next review <b className="text-on-surface">{proc.reviewNext}</b></span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant pt-4">
            <Button variant={asking ? 'dark' : 'outlined'} onClick={() => setAsking((x) => !x)} aria-pressed={asking}><MessageCircleQuestion size={17} />Ask a question</Button>
            <span className="text-sm text-on-surface-variant">Something not right? Tell {proc.owner}.</span>
          </div>
          {asking && <AskPanel proc={proc} docked onClose={() => setAsking(false)} onShowStage={(k) => { onShowStage?.(k); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
        </div>

        {/* what starts it and what "done" means */}
        <div className="flex flex-col gap-5 rounded-[28px] bg-white p-6">
          <div className="flex flex-col gap-2.5">
            <h3 className="m-0 flex items-center gap-2 text-base font-extrabold"><Flag size={18} className="text-primary" aria-hidden />It starts when…</h3>
            {proc.triggers.length
              ? <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{proc.triggers.map((t) => <li key={t} className="flex items-start gap-2 text-sm"><span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-primary" />{t}</li>)}</ul>
              : <p className="m-0 text-sm text-on-surface-variant">Not added yet.</p>}
          </div>
          <div className="flex flex-col gap-2.5">
            <h3 className="m-0 flex items-center gap-2 text-base font-extrabold"><Check size={18} className="text-secondary" strokeWidth={3} aria-hidden />It's done when…</h3>
            {proc.outcomes.length
              ? <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{proc.outcomes.map((o) => <li key={o} className="flex items-start gap-2 text-sm"><Check size={15} className="mt-0.5 flex-none text-secondary" strokeWidth={3} />{o}</li>)}</ul>
              : <p className="m-0 text-sm text-on-surface-variant">Not added yet.</p>}
          </div>
        </div>
      </div>

      {cases.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[28px] bg-white p-6">
          <h2 className="m-0 flex flex-wrap items-baseline gap-x-3 text-xl font-extrabold"><span className="inline-flex items-center gap-2"><Undo2 size={20} className="text-tertiary" aria-hidden />What if…?</span><span className="text-sm font-semibold text-on-surface-variant">When things don't go to plan</span></h2>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {cases.map((x, k) => (
              <div key={k} className="flex flex-col gap-1 rounded-2xl bg-[#FFF7E6] px-4 py-3 text-sm">
                <b><Terms text={x.case} /></b>
                {x.handled && <span className="text-[13px] text-[#7A3A00]">→ <Terms text={x.handled} /></span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(policies.length > 0 || related.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {[['The rules behind it', 'Policies and standards that apply to the whole process', policies], ['Related processes', 'Work that leads into this one or follows on', related]].map(([title, note, items]) => (items as LibraryItem[]).length > 0 && (
            <div key={title as string} className="flex flex-col gap-3 rounded-[28px] bg-white p-6">
              <div><h2 className="m-0 text-lg font-extrabold">{title as string}</h2><p className="m-0 text-[13px] text-on-surface-variant">{note as string}</p></div>
              <div className="flex flex-col gap-1.5">
                {(items as LibraryItem[]).map((it) => (
                  <ResourceLink key={it.id} it={it} className="flex min-h-11 items-center gap-2.5 rounded-2xl bg-surface-low px-3.5 py-2 text-sm font-semibold text-on-surface no-underline hover:bg-surface-mid">
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: catOf(it.category).color }} /><span className="flex-1">{it.title}</span><ChevronRight size={16} className="text-on-surface-variant" />
                  </ResourceLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const Person = ({ label, name, bg, fg }: { label: string; name: string; bg: string; fg: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold" style={{ background: bg, color: fg }}>{initials(name)}</span>
    {label} <b className="text-on-surface">{name}</b>
  </span>
)
