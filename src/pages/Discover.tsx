import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Search, Sparkles, Users, Wallet, HeartHandshake, Box } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { BpmnStatus } from '@/components/BpmnStatus'
import { Button } from '@/components/ui/button'
import { canBuild, useData, useSession } from '@/store/store'
import { displayName, procPath, stepCount } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Process } from '@/lib/types'

const AREA_ICON: Record<string, { icon: typeof Users; bg: string; fg: string }> = {
  'Client & Community': { icon: HeartHandshake, bg: '#DFE7FF', fg: '#1D4ED8' },
  'People & Culture': { icon: Users, bg: '#D3F2DE', fg: '#15803D' },
  'Finance & Procurement': { icon: Wallet, bg: '#FFE9D9', fg: '#C2410C' },
}

const matches = (p: Process, q: string) => {
  if (!q) return true
  const hay = [p.title, p.code, p.summary, p.area, ...p.roles.map((r) => r.name), ...p.stages.map((s) => `${s.title} ${s.short}`), ...p.steps.map((s) => s.label), ...p.triggers].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).filter((w) => w.length > 2).every((w) => hay.includes(w)) || hay.includes(q.toLowerCase())
}

export default function Discover() {
  const processes = useData((s) => s.processes)
  const { persona, myRole, setMyRole } = useSession()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [area, setArea] = useState('All')
  const areas = ['All', ...new Set(processes.map((p) => p.area))]
  const roles = useMemo(() => [...new Set(processes.flatMap((p) => p.roles.map((r) => r.name)))].sort(), [processes])
  const visible = processes
    .filter((p) => p.status === 'published' || canBuild(persona))
    .filter((p) => area === 'All' || p.area === area)
    .filter((p) => matches(p, q))
    .sort((a, b) => Number(b.roles.some((r) => r.name === myRole)) - Number(a.roles.some((r) => r.name === myRole)))

  // "One question to start": what started it? Triggers from processes you're in come first.
  const starts = processes.filter((p) => p.status === 'published' && p.triggers.length)
    .sort((a, b) => Number(b.roles.some((r) => r.name === myRole)) - Number(a.roles.some((r) => r.name === myRole)))
    .flatMap((p) => p.triggers.slice(0, 4).map((t) => ({ p, t }))).slice(0, 8)

  return (
    <div className="min-h-full">
      <AppHeader>
        {canBuild(persona) && (
          <Button variant="outlined" size="sm" onClick={() => nav('/builder')}><Plus size={16} />New process</Button>
        )}
      </AppHeader>
      <main className="mx-auto flex max-w-[880px] flex-col gap-12 px-4 pb-20 pt-12 sm:px-6">
        <section className="flex flex-col items-center gap-6 text-center">
          <h1 className="m-0 text-[clamp(36px,6vw,52px)] font-extrabold leading-[1.05] tracking-[-0.02em]">How does it work?</h1>
          <p className="m-0 max-w-[520px] text-lg leading-relaxed text-on-surface-variant">Search for any process and watch it play out, step by step, in plain words.</p>
          <form role="search" onSubmit={(e) => { e.preventDefault(); if (visible[0]) nav(procPath(visible[0])) }}
            className="flex h-16 w-full items-center gap-3 rounded-full bg-white pl-6 pr-2 shadow-[0_2px_4px_rgba(21,26,37,.04),0_8px_24px_rgba(21,26,37,.08)]">
            <Search size={22} className="text-on-surface-variant" aria-hidden />
            <label htmlFor="q" className="sr-only">Search processes</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. what training does a new client need?"
              className="min-w-0 flex-1 border-0 bg-transparent text-[17px] outline-none" />
            <Button type="submit" size="lg">Search</Button>
          </form>
        </section>

        {starts.length > 0 && !q && (
          <section className="flex flex-col gap-3 rounded-[28px] bg-white p-6 shadow-[0_2px_4px_rgba(21,26,37,.04)]">
            <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold"><Sparkles size={20} className="text-primary" aria-hidden />Not sure where to start? What's happened?</h2>
            <p className="m-0 text-sm text-on-surface-variant">Pick the one that fits. We'll open the right process{myRole ? <> and show just your part as {myRole}</> : ''}.</p>
            <div className="flex flex-wrap gap-2">
              {starts.map(({ p, t }) => {
                const r = p.roles.find((x) => x.name === myRole)
                return (
                  <button key={p.id + t} onClick={() => nav(`${procPath(p)}${r ? `?as=${r.id}` : ''}`)}
                    className="flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl border border-outline-variant bg-white px-4 py-2.5 text-left hover:border-primary hover:bg-primary-container/40">
                    <span className="text-sm font-bold">{t}</span><span className="text-xs text-on-surface-variant">→ {displayName(p)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <BpmnStatus />
          <div className="flex flex-wrap items-center gap-2">
            {areas.map((a) => (
              <button key={a} onClick={() => setArea(a)}
                className={cn('h-9 cursor-pointer rounded-full border px-4 text-sm font-semibold', area === a ? 'border-on-surface bg-on-surface text-white' : 'border-outline-variant bg-white text-on-surface-variant hover:bg-surface-low')}>
                {a}
              </button>
            ))}
            <div className="flex-1" />
            <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
              I work as
              <select value={roles.includes(myRole) ? myRole : ''} onChange={(e) => setMyRole(e.target.value)} className="h-9 rounded-full border border-outline-variant bg-white px-3 text-[13px] font-bold text-on-surface">
                {!roles.includes(myRole) && <option value="">Choose your role…</option>}
                {roles.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2.5">
            {visible.length === 0 && (q
              ? <p className="rounded-[20px] bg-white p-6 text-on-surface-variant">No process matches “{q}”. Try fewer words.</p>
              : <p className="rounded-[20px] bg-white p-6 text-on-surface-variant">No processes yet. A Global Admin adds them from Signavio: <b>Admin → Processes → Prepare the page</b>.</p>)}
            {visible.map((p) => {
              const a = AREA_ICON[p.area] ?? { icon: Box, bg: '#E5E8F2', fg: '#151A25' }
              const Icon = a.icon
              const mine = p.roles.some((r) => r.name === myRole)
              const n = stepCount(p)
              return (
                <Link key={p.id} to={procPath(p)} className="flex items-center gap-5 rounded-[20px] bg-white px-6 py-5 text-on-surface no-underline transition-shadow hover:shadow-[0_4px_16px_rgba(21,26,37,.08)]">
                  <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl" style={{ background: a.bg, color: a.fg }}><Icon size={28} aria-hidden /></span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-extrabold">{displayName(p)}</span>
                      {p.source?.kind === 'bpmn' && <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-bold text-on-primary-container">Signavio</span>}
                      {p.status === 'draft' && <span className="rounded-full bg-surface-mid px-2 py-0.5 text-xs font-bold">Draft</span>}
                      {mine && <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-bold text-on-secondary-container">You're in this</span>}
                      {p.needsCompleting && <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-bold text-[#9A4A00]">Being completed</span>}
                    </span>
                    <span className="truncate text-sm text-on-surface-variant">{p.roles.map((r) => r.name).join(' → ')}</span>
                  </span>
                  <span className="whitespace-nowrap text-[13px] text-on-surface-variant">{p.stages.length} stages{n ? ` · ${n} steps` : ''}</span>
                  <ChevronRight size={20} className="text-on-surface-variant" aria-hidden />
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
