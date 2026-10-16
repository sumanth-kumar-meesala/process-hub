import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, FileText, Flag, Minus, MousePointerClick, Pencil, Play, Plus, Trophy, Users, X, Monitor, ShieldCheck, Share2, HeartHandshake, Bot, Plug, Undo2 } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Card, Tag } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import Islands3D from '@/three/Islands3D'
import { canEdit, useData, useSession } from '@/store/store'
import { allSystems, roleKind, stageRoles, stepCount } from '@/lib/derive'
import { catOf, processResources, stageResources, stepResources } from '@/lib/resources'
import { tint, type LibraryItem, type Process } from '@/lib/types'
import { cn } from '@/lib/utils'

type View = 'overview' | 'role' | 'owner'

export default function ProcessPage() {
  const { id } = useParams()
  const proc = useData((s) => s.processes.find((p) => p.id === id))
  const hydrated = useData((s) => s.hydrated)
  if (!proc) return (
    <div><AppHeader /><p className="p-10 text-on-surface-variant">{hydrated ? 'That process could not be found.' : 'Loading…'} <Link to="/">Back to processes</Link></p></div>
  )
  return <ProcessView proc={proc} />
}

function ProcessView({ proc }: { proc: Process }) {
  const { persona, myRole } = useSession()
  const nav = useNavigate()
  const [i, setI] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0)
  const [view, setView] = useState<View>('overview')
  const n = proc.stages.length
  const stage = proc.stages[i]
  const mine = role ? proc.stages.map((s, k) => (stageRoles(proc, s).some((r) => r.id === role) ? k + 1 : 0)).filter(Boolean) : []
  const select = (k: number) => { setI(k); setOpen(true) }
  const next = () => setI((x) => (n ? (x + 1) % n : 0))

  return (
    <div className="min-h-full">
      <AppHeader>
        {canEdit(persona, proc) && <Button variant="outlined" size="sm" onClick={() => nav(`/builder/${proc.id}`)}><Pencil size={15} />Edit in Builder</Button>}
      </AppHeader>
      <main className="mx-auto flex max-w-[1360px] flex-col gap-7 px-3 pb-20 pt-1 sm:px-6">
        {proc.needsCompleting && (
          <div className="flex items-center gap-3 rounded-[18px] bg-tertiary-container px-5 py-3 text-sm text-[#7A3A00]">
            <Pencil size={16} aria-hidden />This process is still being completed by its owner ({proc.owner}). Some stages don't have their steps yet.
          </div>
        )}

        {/* ---------- 3D hero ---------- */}
        <section className="dot-grid relative flex flex-col gap-4 overflow-hidden rounded-[36px] p-4 sm:p-7">
          <div className="relative z-[1] flex flex-wrap items-start gap-4">
            <div className="flex min-w-[min(460px,100%)] flex-1 flex-col gap-2">
              <nav aria-label="Breadcrumb" className="flex gap-1.5 text-sm font-semibold text-on-surface-variant"><Link to="/" className="no-underline">Processes</Link><span aria-hidden>/</span><span>{proc.area}</span></nav>
              <div className="flex flex-wrap items-center gap-3">
                {proc.code && <span className="inline-flex h-8 items-center rounded-[10px] bg-primary px-3 text-[15px] font-extrabold text-white">{proc.code}</span>}
                <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em]">{proc.title}</h1>
              </div>
              <p className="m-0 max-w-[640px] text-base leading-normal text-on-surface-variant">{proc.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <OwnerCard label="Process owner" name={proc.owner} bg="#DFE7FF" fg="#0A2472" />
              {proc.executiveOwner && <OwnerCard label="Executive owner" name={proc.executiveOwner} bg="#D3F2DE" fg="#0B3D20" />}
              {proc.reviewNext && (
                <div className="glass flex min-w-[150px] flex-col gap-1 rounded-[18px] px-4 py-3">
                  <span className="lbl">Next review</span><b className="text-sm">{proc.reviewNext}</b>
                  <span className="h-[5px] rounded bg-surface-mid"><span className="block h-[5px] w-[88%] rounded bg-[#EA580C]" /></span>
                </div>
              )}
            </div>
          </div>

          <div className="glass relative z-[1] flex flex-wrap items-center gap-1.5 self-start rounded-[22px] p-2">
            <span className="px-2 text-[13px] font-bold text-on-surface-variant">Show me as</span>
            <RoleChip on={role === null} color="#151A25" name="Everyone" onClick={() => setRole(null)} />
            {proc.roles.map((r) => <RoleChip key={r.id} on={role === r.id} color={r.color} name={r.name} onClick={() => setRole(r.id)} />)}
            {role && <span className="px-2.5 text-[13px] font-semibold text-primary">{mine.length ? `In stage${mine.length > 1 ? 's' : ''} ${mine.join(', ')}` : 'Not in any stage yet'}</span>}
          </div>

          <div className="relative -mx-2 h-[clamp(320px,42vw,500px)]">
            <Islands3D process={proc} active={i} onSelect={select} hover={hover} onHover={setHover} roleFilter={role} zoomLevel={zoom} avatarLabel="I am here" />
            {n === 0 && <div className="absolute inset-0 flex items-center justify-center"><span className="glass rounded-full px-5 py-2.5 text-sm font-bold">The owner hasn't added stages yet</span></div>}

            {!open && n > 0 && (
              <span className="glass absolute left-3 top-1 z-[40] inline-flex h-[34px] items-center gap-2 rounded-full px-3.5 text-[13px] font-bold text-on-surface-variant"><MousePointerClick size={14} aria-hidden />Click an island for details</span>
            )}
            {open && stage && <StagePanel proc={proc} k={i} onClose={() => setOpen(false)} onNext={next} />}

            <div className="glass absolute bottom-3 right-3 z-[40] flex gap-0.5 rounded-full p-1">
              <Button variant="icon" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => z - 1)}><Minus size={18} /></Button>
              <Button variant="icon" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => z + 1)}><Plus size={18} /></Button>
            </div>
          </div>

          {n > 0 && (
            <div className="glass relative z-[1] flex flex-col gap-4 rounded-[26px] px-5 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <Share2 size={20} className="text-primary" aria-hidden />
                <h2 className="m-0 text-lg font-extrabold">Process journey</h2>
                <span className="text-[13px] text-on-surface-variant">{n} stages{stepCount(proc) ? ` · ${stepCount(proc)} steps` : ''}{proc.triggers.length ? ` · starts with 1 of ${proc.triggers.length} trigger${proc.triggers.length > 1 ? 's' : ''}` : ''}</span>
                <div className="flex-1" />
                <Button variant="outlined" size="iconLg" aria-label="Previous stage" onClick={() => setI((x) => Math.max(0, x - 1))}><ChevronLeft size={18} /></Button>
                <Button onClick={next}><Play size={15} fill="#fff" />{i === n - 1 ? 'Play again' : 'Next stage'}</Button>
              </div>
              <div className="flex overflow-x-auto">
                {proc.stages.map((s, k) => {
                  const done = k <= i
                  return (
                    <button key={s.id} onClick={() => select(k)} className="flex min-w-[104px] flex-1 cursor-pointer flex-col items-center gap-2 border-0 bg-transparent px-0.5 text-center text-[13px] font-bold leading-tight text-on-surface">
                      <span className="flex w-full items-center">
                        <span className="h-[3px] flex-1 rounded" style={{ background: k === 0 ? 'transparent' : done ? proc.stages[k - 1].color : '#D3D7E2' }} />
                        <span className="flex h-11 w-11 items-center justify-center rounded-full text-base font-extrabold transition-all"
                          style={{ background: done ? s.color : '#fff', color: done ? '#fff' : s.color, boxShadow: k === i ? `0 0 0 6px ${s.color}33` : `inset 0 0 0 2px ${s.color}` }}>{k + 1}</span>
                        <span className="h-[3px] flex-1 rounded" style={{ background: k === n - 1 ? 'transparent' : k < i ? s.color : '#D3D7E2' }} />
                      </span>
                      <span>{s.short}</span>
                      <span className="text-xs font-semibold text-on-surface-variant">{stageRoles(proc, s).map((r) => r.name).join(' · ')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* ---------- details ---------- */}
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="m-0 text-2xl font-extrabold">More about this process</h2>
          <div className="flex-1" />
          <Segmented label="View" value={view} onChange={setView} options={[{ id: 'overview', label: 'Overview' }, { id: 'role', label: 'My role' }, { id: 'owner', label: 'Owner' }]} />
        </div>
        {view === 'overview' && <Overview proc={proc} />}
        {view === 'role' && <RoleView proc={proc} initial={proc.roles.find((r) => r.name === myRole)?.id ?? proc.roles[0]?.id} />}
        {view === 'owner' && <OwnerView proc={proc} />}
      </main>
    </div>
  )
}

const OwnerCard = ({ label, name, bg, fg }: { label: string; name: string; bg: string; fg: string }) => (
  <div className="glass flex items-center gap-2.5 rounded-[18px] px-4 py-3">
    <span className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold" style={{ background: bg, color: fg }}>{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
    <div><div className="lbl">{label}</div><b className="text-sm">{name}</b></div>
  </div>
)

const RoleChip = ({ on, color, name, onClick }: { on: boolean; color: string; name: string; onClick: () => void }) => (
  <button onClick={onClick} aria-pressed={on}
    className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border pl-2.5 pr-3.5 text-[13px] font-semibold', on ? 'border-on-surface bg-on-surface text-white' : 'border-outline-variant bg-white text-on-surface hover:bg-surface-low')}>
    <span className="h-3 w-3 rounded-full shadow-[0_0_0_2px_#fff]" style={{ background: color }} />{name}
  </button>
)

/** Opens a library item: its link, the Process Hub process it stands for, or nothing yet. */
function ResourceLink({ it, className, children }: { it: LibraryItem; className: string; children: React.ReactNode }) {
  const processes = useData((st) => st.processes)
  if (it.category === 'process') {
    const target = processes.find((p) => p.id === it.processId || p.title.toLowerCase() === it.title.toLowerCase())
    if (target) return <Link to={`/process/${target.id}`} className={className}>{children}</Link>
  }
  if (it.url) return <a href={it.url} target="_blank" rel="noreferrer" className={className}>{children}</a>
  return <a href="#" onClick={(e) => e.preventDefault()} title="No link added yet" className={className}>{children}</a>
}

function StagePanel({ proc, k, onClose, onNext }: { proc: Process; k: number; onClose: () => void; onNext: () => void }) {
  const library = useData((st) => st.library)
  const s = proc.stages[k]
  const needs = stageResources(proc, s.id, library)
  const roles = stageRoles(proc, s)
  const nextS = proc.stages[k + 1]
  const steps = proc.steps.filter((x) => x.stageId === s.id && (x.kind === 'step' || x.kind === 'decision'))
  const checks = steps.filter((x) => x.kind === 'decision').map((d) => {
    const e = proc.edges.find((e) => e.from === d.id && /^no$/i.test(e.label ?? ''))
    const no = e ? proc.steps.find((x) => x.id === e.to) : undefined
    return { id: d.id, label: d.label, no, noStage: no ? proc.stages.findIndex((st) => st.id === no.stageId) : -1 }
  })
  return (
    <aside className="glass absolute left-2 top-0 z-[40] flex max-h-full w-[340px] max-w-[calc(100%-16px)] flex-col overflow-hidden rounded-[28px] shadow-[0_2px_6px_rgba(15,23,42,.06),0_24px_60px_rgba(30,58,138,.22)]" aria-label={`Stage ${k + 1} details`}>
      <div className="relative flex flex-col gap-3 px-5 pb-4 pt-5" style={{ background: tint(s.color, 0.14) }}>
        <button onClick={onClose} aria-label="Close details" className="absolute right-3.5 top-3.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-white/75"><X size={16} /></button>
        <div className="flex items-center gap-3">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] text-2xl font-extrabold text-white" style={{ background: s.color, boxShadow: `0 6px 16px ${s.color}55` }}>{k + 1}</span>
          <div className="flex flex-col"><span className="text-xs font-extrabold uppercase tracking-[.06em]" style={{ color: s.color }}>Stage {k + 1} of {proc.stages.length}</span><span className="text-[13px] text-on-surface-variant">at {s.place}</span></div>
        </div>
        <h2 className="m-0 pr-8 text-[22px] font-extrabold leading-tight">{s.title}</h2>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5 pt-4">
        <p className="m-0 text-sm leading-relaxed text-on-surface-variant">{s.text}</p>
        {steps.length > 0 && (
          <div className="flex flex-col gap-1.5"><span className="lbl">What happens</span>
            {steps.map((st) => (
              <div key={st.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm"><span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: s.color }} />{st.label}<span className="text-xs text-on-surface-variant">· {proc.roles.find((r) => r.id === st.roleId)?.name}</span></div>
                {stepResources(st, library).length > 0 && (
                  <div className="ml-3.5 flex flex-wrap gap-1">{stepResources(st, library).map((it) => (
                    <span key={it.id} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold" style={{ background: tint(catOf(it.category).color, 0.12), color: '#151A25' }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: catOf(it.category).color }} />{it.title}</span>
                  ))}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {roles.length > 0 && (
          <div className="flex flex-col gap-2"><span className="lbl">Who does it</span>
            {roles.map((r) => roleKind(r) === 'agent' ? (
              <div key={r.id} className="flex flex-col gap-2 rounded-2xl p-3" style={{ background: tint(r.color, 0.1) }}>
                <div className="flex items-center gap-2.5 text-sm font-bold">
                  <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] text-white" style={{ background: r.color }}><Bot size={17} /></span>
                  <span className="flex flex-col leading-tight">{r.name}<span className="text-xs font-semibold text-on-surface-variant">AI agent — works automatically</span></span>
                </div>
                {r.tools?.length ? (
                  <div className="flex flex-col gap-1.5"><span className="text-xs font-bold text-on-surface-variant">Tools it can use</span>
                    <div className="flex flex-wrap gap-1.5">{r.tools.map((t) => <span key={t} className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-white px-2 text-xs font-semibold" style={{ borderColor: r.color }}><Plug size={13} style={{ color: r.color }} />{t}</span>)}</div>
                  </div>
                ) : <span className="text-xs text-on-surface-variant">No tools listed yet</span>}
              </div>
            ) : (
              <div key={r.id} className="flex items-center gap-2.5 text-sm font-bold">
                <span className="flex h-[30px] w-[30px] items-end justify-center overflow-hidden rounded-full" style={{ background: r.color }}><span className="mb-[9px] h-3.5 w-3.5 rounded-full bg-[#F5D0A9]" /></span>{r.name}
              </div>
            ))}
          </div>
        )}
        {checks.length > 0 && (
          <div className="flex flex-col gap-2"><span className="lbl">Checks here</span>
            {checks.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 rounded-[14px] bg-[#FFF7E6] px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 font-bold"><span className="h-3 w-3 rotate-45 rounded-[2px] bg-[#FBBF24]" />{c.label}</span>
                {c.no && <span className="flex items-center gap-1.5 text-[13px] text-[#9A3412]"><Undo2 size={14} />If not: back to “{c.no.label}”{c.noStage !== k ? ` (stage ${c.noStage + 1})` : ''}</span>}
              </div>
            ))}
          </div>
        )}
        {s.systems.length > 0 && <div className="flex flex-col gap-2"><span className="lbl">Systems</span><div className="flex flex-wrap gap-1.5">{s.systems.map((x) => <Tag key={x} className="bg-ink text-white">{x}</Tag>)}</div></div>}
        {(needs.length > 0 || s.docs.length > 0) && (
          <div className="flex flex-col gap-1.5"><span className="lbl">You'll need</span>
            {needs.map((it) => (
              <ResourceLink key={it.id} it={it} className="flex min-h-11 items-center gap-2.5 rounded-[14px] bg-surface-low px-3 py-1.5 text-sm font-semibold text-on-surface no-underline hover:bg-surface-mid">
                <FileText size={18} style={{ color: catOf(it.category).color }} /><span className="flex flex-1 flex-col leading-tight">{it.title}<span className="text-[11px] font-medium text-on-surface-variant">{catOf(it.category).one}</span></span><ArrowUpRight size={16} className="text-on-surface-variant" />
              </ResourceLink>
            ))}
            {s.docs.map((d) => <span key={d} className="flex h-11 items-center gap-2.5 rounded-[14px] bg-surface-low px-3 text-sm font-semibold"><FileText size={18} style={{ color: s.color }} /><span className="flex-1">{d}</span></span>)}
          </div>
        )}
        <button onClick={onNext} className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border-0 bg-surface-low px-3.5 py-3 text-left text-sm font-semibold hover:bg-surface-mid">
          <span className="flex-1"><span className="lbl mb-0.5 block">Then</span>{nextS ? `${nextS.short} · ${stageRoles(proc, nextS).map((r) => r.name).join(' & ')}` : proc.outcomes[0] ?? 'Done'}</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-on-surface"><ArrowRight size={16} color="#fff" /></span>
        </button>
      </div>
    </aside>
  )
}

const Check2 = () => <Check size={18} className="mt-0.5 flex-none text-secondary" strokeWidth={2.6} aria-hidden />

const CAT_ICON = { form: FileText, 'client-doc': HeartHandshake, guide: Monitor, policy: ShieldCheck, process: Share2 } as const

function Overview({ proc }: { proc: Process }) {
  const library = useData((st) => st.library)
  // library links, or the older fixed groups for data saved before the library existed
  const groups = processResources(proc, library).length ? processResources(proc, library)
    : proc.resources.map((g) => ({ id: 'form' as const, title: g.title, note: g.note, color: g.color, one: '', items: g.items.map((t) => ({ it: { id: t, title: t, category: 'form' as const }, usedBy: [] as string[] })) }))
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-2.5 bg-secondary-container text-on-secondary-container">
        <span className="lbl text-on-secondary-container">In a nutshell</span>
        <p className="m-0 text-[19px] font-semibold leading-relaxed">{proc.nutshell}</p>
        <p className="m-0 text-sm">Something not right? {proc.owner} looks after this one.</p>
      </Card>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5"><Flag size={22} className="text-primary" aria-hidden /><h3 className="m-0 text-[17px] font-extrabold">It starts when…</h3></div>
          <div className="flex flex-wrap gap-2">{proc.triggers.map((t, k) => <Tag key={t} color={['#2563EB', '#16A34A', '#EA580C', '#7C3AED', '#DC2626', '#0EA5E9', '#DB2777'][k % 7]}>{t}</Tag>)}</div>
        </Card>
        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5"><Trophy size={22} className="text-[#0F766E]" aria-hidden /><h3 className="m-0 text-[17px] font-extrabold">It's done when…</h3></div>
          {proc.outcomes.length ? proc.outcomes.map((o) => <div key={o} className="flex items-start gap-2.5 text-sm"><Check2 />{o}</div>) : <p className="m-0 text-sm text-on-surface-variant">[To be completed by the owner]</p>}
        </Card>
        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5"><Users size={22} className="text-[#F97316]" aria-hidden /><h3 className="m-0 text-[17px] font-extrabold">Who's involved</h3></div>
          {proc.audience && <p className="m-0 text-sm leading-relaxed text-on-surface-variant">{proc.audience}</p>}
          <div className="flex flex-wrap gap-2">{proc.roles.map((r) => <Tag key={r.id} color={r.color}>{r.name}</Tag>)}</div>
        </Card>
      </div>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-3"><h3 className="m-0 text-xl font-extrabold">Resources</h3><span className="text-sm text-on-surface-variant">{groups.reduce((a, g) => a + g.items.length, 0)} documents, guides and links — from the shared library</span></div>
        {groups.length === 0 ? <Card className="text-sm text-on-surface-variant">No resources linked yet.</Card> : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3.5">
            {groups.map((g) => {
              const Icon = CAT_ICON[g.id]
              return (
                <div key={g.id} className="flex flex-col gap-3.5 rounded-[24px] p-5" style={{ background: tint(g.color, 0.13) }}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[14px]" style={{ background: g.color }}><Icon size={22} color="#fff" aria-hidden /></span>
                    <div><div className="text-[15px] font-extrabold">{g.title}</div><div className="text-xs text-on-surface-variant">{g.note}</div></div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {g.items.map(({ it, usedBy }) => (
                      <ResourceLink key={it.id} it={it} className="flex min-h-11 items-center gap-2.5 rounded-[14px] bg-white px-3 py-1.5 text-sm font-semibold text-on-surface no-underline hover:shadow-md">
                        <span className="flex flex-1 flex-col leading-tight">{it.title}{usedBy.length > 0 && <span className="text-[11px] font-medium text-on-surface-variant">Used in: {usedBy.slice(0, 2).join(', ')}{usedBy.length > 2 ? ` +${usedBy.length - 2}` : ''}</span>}</span>
                        <ChevronRight size={16} style={{ color: g.color }} />
                      </ResourceLink>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function RoleView({ proc, initial }: { proc: Process; initial?: string }) {
  const [rid, setRid] = useState(initial)
  const role = proc.roles.find((r) => r.id === rid)
  const det = proc.roleDetails.find((d) => d.roleId === rid)
  const stages = proc.stages.map((s, k) => ({ s, k })).filter(({ s }) => stageRoles(proc, s).some((r) => r.id === rid))
  const steps = proc.steps.filter((s) => s.roleId === rid && (s.kind === 'step' || s.kind === 'decision'))
  const systems = det?.systems ?? [...new Set(stages.flatMap(({ s }) => s.systems))]
  const library = useData((st) => st.library)
  const docs = det?.documents ?? [...new Set([...steps.flatMap((x) => stepResources(x, library).map((it) => it.title)), ...stages.flatMap(({ s }) => s.docs)])]
  if (!role) return <Card>No roles yet.</Card>
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[min(380px,100%)] flex-1 flex-col gap-3">
          <label className="flex items-center gap-2.5 text-sm text-on-surface-variant">My role
            <select value={rid} onChange={(e) => setRid(e.target.value)} className="h-10 rounded-full border border-outline-variant bg-white px-3.5 text-[15px] font-bold text-on-surface">
              {proc.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <h2 className="m-0 text-[26px] font-extrabold">Your part as {role.name}</h2>
          <p className="m-0 text-[15px] leading-relaxed text-on-surface-variant">{det?.summary ? `${det.summary} ` : ''}{stages.length ? `You're in stage${stages.length > 1 ? 's' : ''} ${stages.map(({ k }) => k + 1).join(', ')}.` : "You don't have a stage in this process yet."}</p>
        </div>
        {(det?.responsibilities.length || steps.length) ? (
          <div className="flex min-w-[min(320px,100%)] flex-1 flex-col gap-2 rounded-[18px] bg-primary-container p-4 text-on-primary-container">
            <span className="lbl text-on-primary-container">{det ? "You're responsible for" : 'Your steps'}</span>
            {(det?.responsibilities ?? steps.map((s) => s.label)).map((x) => <div key={x} className="text-sm">• {x}</div>)}
          </div>
        ) : null}
      </Card>
      {det && det.byTrigger.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-[17px] font-extrabold">What you do, depending on what started it</h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {det.byTrigger.map((t) => (
              <div key={t.trigger} className="flex flex-col gap-3 rounded-[22px] p-[18px]" style={{ background: tint(t.color, 0.12) }}>
                <span className="flex items-center gap-2 font-extrabold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />{t.trigger}</span>
                {t.actions.map((a) => <div key={a.text} className="flex flex-col gap-1 rounded-[14px] bg-white px-3 py-2.5 text-sm"><span className="font-semibold">{a.text}</span><span className="text-xs text-on-surface-variant">in {a.system}</span></div>)}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
        {det && det.rules.length > 0 && <Card className="flex flex-col gap-2.5"><h3 className="m-0 text-[17px] font-extrabold">Rules you must follow</h3>{det.rules.map((r) => <div key={r} className="flex items-start gap-2.5 text-sm"><Check2 />{r}</div>)}</Card>}
        <Card className="flex flex-col gap-2.5"><h3 className="m-0 text-[17px] font-extrabold">Systems you use</h3>
          <div className="flex flex-wrap gap-2">{systems.length ? systems.map((s) => <Tag key={s} className="bg-ink text-white">{s}</Tag>) : <span className="text-sm text-on-surface-variant">None listed yet</span>}</div>
          {docs.length > 0 && <><span className="lbl mt-2.5">Your documents</span>{docs.map((d) => <span key={d} className="flex items-center gap-2 text-sm font-semibold"><FileText size={16} className="text-primary" />{d}</span>)}</>}
        </Card>
        {det && det.policies.length > 0 && <Card className="flex flex-col gap-2"><h3 className="m-0 mb-1 text-[17px] font-extrabold">Policies & guides</h3>{det.policies.map((d) => <span key={d} className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-[#EA580C]" />{d}</span>)}</Card>}
      </div>
    </div>
  )
}

function OwnerView({ proc }: { proc: Process }) {
  const o = proc.ownerDetail
  const metrics = useMemo(() => [
    { n: o?.processMaps ?? 1, t: 'Process maps', s: 'In this hub' },
    { n: o?.activities ?? stepCount(proc), t: 'Activities', s: `Across ${proc.stages.length} stages` },
    { n: proc.roles.length, t: 'Roles', s: 'See My role' },
    { n: allSystems(proc).length, t: 'Systems', s: 'Supporting the process' },
    { n: o?.pendingChanges ?? 0, t: 'Pending changes', s: 'Awaiting approval', warn: true },
  ], [o, proc])
  const List = ({ title, items, className = '' }: { title: string; items: string[]; className?: string }) => (
    <Card className={cn('flex flex-col gap-2', className)}><h3 className="m-0 text-[17px] font-extrabold">{title}</h3>{items.map((x) => <div key={x} className="text-sm">• {x}</div>)}</Card>
  )
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {metrics.map((m) => (
          <Card key={m.t} className={cn('p-[18px]', m.warn && m.n ? 'bg-[#FFF4E5]' : '')}>
            <div className={cn('text-[32px] font-extrabold', m.warn && m.n ? 'text-[#9A4A00]' : '')}>{m.n}</div><div className="font-bold">{m.t}</div><div className="text-[13px] text-on-surface-variant">{m.s}</div>
          </Card>
        ))}
      </div>
      {!o ? <Card className="text-sm text-on-surface-variant">Owner details (scope, risks, controls, change history) haven't been added for this process yet.</Card> : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            <List title="Scope" items={o.scope} />
            <List title="Outcomes" items={o.outcomes} />
            <List title="Key risks" items={o.risks} className="bg-error-container [&_h3]:text-error" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-5">
            <Card className="flex flex-col gap-3"><h3 className="m-0 text-[17px] font-extrabold">Your responsibilities as owner</h3>
              <div className="grid grid-cols-3 gap-3 text-[13px] leading-normal">
                <div><div className="lbl mb-1.5">Accountable for</div>{o.accountable.join(' · ')}</div>
                <div><div className="lbl mb-1.5">Consulted on</div>{o.consulted.join(' · ')}</div>
                <div><div className="lbl mb-1.5">Approves</div>{o.approves.join(' · ')}</div>
              </div>
            </Card>
            <Card className="flex flex-col gap-3"><h3 className="m-0 text-[17px] font-extrabold">How it connects</h3>
              <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
                <div className="min-w-[140px] flex-1 rounded-[14px] bg-surface-low p-3"><div className="lbl mb-1">Comes from</div>{o.upstream.join(' · ')}</div>
                <ArrowRight size={20} className="text-on-surface-variant" aria-hidden />
                <div className="rounded-[14px] bg-primary px-3.5 py-3 font-extrabold text-white">{proc.code ?? 'This'}</div>
                <ArrowRight size={20} className="text-on-surface-variant" aria-hidden />
                <div className="min-w-[140px] flex-1 rounded-[14px] bg-surface-low p-3"><div className="lbl mb-1">Feeds into</div>{o.downstream.join(' · ')}</div>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-5">
            <Card className="flex flex-col gap-2"><h3 className="m-0 mb-1 text-[17px] font-extrabold">Controls</h3>
              <div className="grid grid-cols-2 gap-2 text-[13px]">{o.controls.map((c) => <div key={c} className="flex items-start gap-1.5"><Check size={15} className="mt-0.5 text-secondary" />{c}</div>)}</div>
            </Card>
            <Card className="flex flex-col"><h3 className="m-0 mb-2 text-[17px] font-extrabold">Recent changes</h3>
              {o.changes.map((c) => <div key={c.text} className="flex gap-3.5 border-b border-outline-variant py-2 text-sm last:border-0"><span className="w-[72px] text-on-surface-variant">{c.date}</span>{c.text}</div>)}
            </Card>
          </div>
          <Card className="flex flex-col gap-3.5"><h3 className="m-0 text-[17px] font-extrabold">Who's involved, and how</h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              {o.raci.map((r) => (
                <div key={r.role} className="flex flex-col gap-2 rounded-[14px] bg-surface-low p-3.5"><b className="text-sm">{r.role}</b>
                  <span className={cn('inline-flex h-7 items-center self-start rounded-full px-3 text-[13px] font-semibold', r.level === 'Responsible' || r.level === 'Accountable' ? 'bg-primary text-white' : r.level === 'Consulted' ? 'bg-primary-container text-on-primary-container' : 'bg-white')}>{r.level}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
