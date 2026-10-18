import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, FileText, Flag, Pencil, Trophy, Users, Monitor, ShieldCheck, Share2, HeartHandshake, Undo2, MessageCircleQuestion } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Card, Tag } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import Islands3D from '@/three/Islands3D'
import { canEdit, useData, useSession } from '@/store/store'
import { allSystems, stageRoles, stepCount, sysLabel } from '@/lib/derive'
import { processResources, stepResources } from '@/lib/resources'
import { tint, type Process } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useGuide } from '@/lib/guide'
import { Terms } from '@/components/Terms'
import { AskPanel } from '@/components/process/AskPanel'
import { ResourceLink } from '@/components/process/ResourceLink'
import { ViewSwitch } from '@/components/process/ViewSwitch'
import { StageSidePanel } from '@/components/process/StageSidePanel'

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
  const library = useData((s) => s.library)
  const can3d = useMemo(hasWebGL, [])
  const nav = useNavigate()
  const [hover, setHover] = useState<number | null>(null)
  const [view, setView] = useState<View>('overview')
  const [asking, setAsking] = useState(false)
  // the stage clicked on the map, shown in the side panel
  const [sel, setSel] = useState<number | null>(null)
  const [params] = useSearchParams()
  // the same "Show steps for" and saved progress as the step-by-step guide
  const run = useGuide(proc, library)
  const n = proc.stages.length
  const hasSteps = stepCount(proc) > 0
  const openStage = (k: number) => { setAsking(false); setSel(Math.max(0, Math.min(n - 1, k))) }

  // "One question to start" on the home page sends people here with ?as=<role>
  useEffect(() => {
    const as = params.get('as')
    const r = as && proc.roles.find((x) => x.id === as || x.name.toLowerCase() === as.toLowerCase())
    if (r && run.role !== r.id) run.setRole(r.id)
  }, [params, proc.roles]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAsking(false); setSel(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-full">
      <AppHeader>
        {canEdit(persona, proc) && <Button variant="outlined" size="sm" onClick={() => nav(`/builder/${proc.id}`)}><Pencil size={15} />Edit in Builder</Button>}
      </AppHeader>
      <main className="mx-auto flex max-w-[1360px] flex-col gap-7 px-3 pb-20 pt-1 sm:px-6">
        {proc.draftNote && !proc.needsCompleting && (
          <div className="flex items-start gap-3 rounded-[18px] bg-[#FFF7E6] px-5 py-3 text-sm text-[#7A3A00]">
            <Pencil size={16} className="mt-0.5 flex-none" aria-hidden /><span><b>To be confirmed.</b> {proc.draftNote}</span>
          </div>
        )}
        {proc.needsCompleting && (
          <div className="flex items-center gap-3 rounded-[18px] bg-tertiary-container px-5 py-3 text-sm text-[#7A3A00]">
            <Pencil size={16} aria-hidden />This process is still being completed by its owner ({proc.owner}). Some stages don't have their steps yet.
          </div>
        )}

        {/* ---------- the process at a glance ---------- */}
        <section className="dot-grid relative flex flex-col gap-4 overflow-clip rounded-[36px] p-4 sm:px-8 sm:py-7">
          <div className="relative z-[1] flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="flex min-w-[min(420px,100%)] flex-1 flex-col gap-1.5">
            <nav aria-label="Breadcrumb" className="flex gap-1.5 text-[13px] font-semibold text-on-surface-variant"><Link to="/" className="no-underline">Processes</Link><span aria-hidden>/</span><span>{proc.area}</span></nav>
            <div className="flex flex-wrap items-center gap-3">
              {proc.code && <span className="inline-flex h-7 items-center rounded-[9px] bg-primary px-2.5 text-sm font-extrabold text-white">{proc.code}</span>}
              <h1 className="m-0 text-[clamp(26px,3.2vw,38px)] font-extrabold leading-[1.1] tracking-[-0.02em]">{proc.title}</h1>
            </div>
            <p className="m-0 max-w-[760px] text-[16px] leading-snug text-on-surface-variant"><Terms text={proc.summary} /></p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-variant">
              <Person label="Owner" name={proc.owner} bg="#DFE7FF" fg="#0A2472" />
              {proc.executiveOwner && <Person label="Executive" name={proc.executiveOwner} bg="#D3F2DE" fg="#0B3D20" />}
              {proc.reviewNext && <span>Next review <b className="text-on-surface">{proc.reviewNext}</b></span>}
            </div>
          </div>
          {hasSteps && <ViewSwitch procId={proc.id} current="3d" />}
          </div>

          {hasSteps && (
            <div className="relative z-[1] flex flex-wrap items-center gap-3 print:hidden">
              <label className="flex h-14 items-center gap-2 rounded-full border border-outline-variant bg-white pl-5 pr-2 text-[15px] font-bold">
                Show steps for
                <select value={run.role ?? ''} onChange={(e) => run.setRole(e.target.value || null)}
                  className="h-10 max-w-[220px] rounded-full border-0 bg-surface-low px-3 text-[15px] font-bold text-on-surface">
                  <option value="">Everyone</option>
                  {proc.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <Button variant="outlined" size="lg" className="h-14" onClick={() => setAsking((x) => !x)} aria-pressed={asking}><MessageCircleQuestion size={18} />Ask a question</Button>
            </div>
          )}

          {n === 0 ? (
            <p className="relative z-[1] m-0 rounded-[20px] bg-white p-6 text-sm text-on-surface-variant">The owner hasn't added stages yet.</p>
          ) : (
            <div className="relative z-[1] flex flex-col gap-2">
              <p className="m-0 text-[15px] font-semibold text-on-surface-variant">
                {run.roleObj ? <>The stages the <b className="text-on-surface">{run.roleObj.name}</b> is part of are highlighted. </> : null}
                {can3d ? 'Click a stage to see its steps.' : 'Choose a stage to see its steps.'}
              </p>
              {can3d ? (
                <div className={cn('grid gap-4', (sel !== null || asking) && 'lg:grid-cols-[minmax(0,1fr)_400px]')}>
                  <div className="relative -mx-2 h-[min(clamp(360px,36vw,520px),calc(100vh-300px))] min-h-[340px] max-sm:h-[420px]">
                    <Islands3D process={proc} active={sel ?? -1} quiet onSelect={openStage} hover={hover} onHover={setHover} roleFilter={run.role} onBackground={() => setSel(null)} />
                  </div>
                  {sel !== null && !asking && (
                    <div className="h-[min(clamp(360px,36vw,520px),calc(100vh-300px))] min-h-[340px] max-lg:h-auto">
                      <StageSidePanel key={sel} proc={proc} g={run.g} k={sel} roleId={run.role} onClose={() => setSel(null)} onStage={openStage} />
                    </div>
                  )}
                  {asking && <AskPanel proc={proc} docked onClose={() => setAsking(false)} onShowStage={openStage} />}
                </div>
              ) : (
                <>
                  <ol className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {proc.stages.map((s, k) => {
                      const off = !!run.role && !stageRoles(proc, s).some((r) => r.id === run.role)
                      return (
                        <li key={s.id}>
                          <button onClick={() => openStage(k)} className={cn('flex w-full cursor-pointer items-center gap-3 rounded-2xl border-0 bg-white px-4 py-3.5 text-left', off && 'opacity-40')}>
                            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-base font-extrabold text-white" style={{ background: s.color }}>{k + 1}</span>
                            <span className="flex min-w-0 flex-col"><b className="text-[16px]">{s.short || s.title}</b><span className="text-[13px] text-on-surface-variant">{stageRoles(proc, s).map((r) => r.name).join(' · ')}</span></span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                  {sel !== null && !asking && <StageSidePanel key={sel} proc={proc} g={run.g} k={sel} roleId={run.role} onClose={() => setSel(null)} onStage={openStage} />}
                  {asking && <AskPanel proc={proc} docked onClose={() => setAsking(false)} onShowStage={openStage} />}
                </>
              )}
            </div>
          )}
        </section>

        {/* ---------- details ---------- */}
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="m-0 text-2xl font-extrabold">More about this process</h2>
          <div className="flex-1" />
          <div className="print:hidden"><Segmented label="View" value={view} onChange={setView} options={[{ id: 'overview', label: 'Overview' }, { id: 'role', label: 'My role' }, { id: 'owner', label: 'Owner' }]} /></div>
        </div>
        {view === 'overview' && <Overview proc={proc} />}
        {view === 'role' && <RoleView proc={proc} initial={proc.roles.find((r) => r.name === myRole)?.id ?? proc.roles[0]?.id} />}
        {view === 'owner' && <OwnerView proc={proc} />}
      </main>
    </div>
  )
}

/** Can this browser draw 3D? If not, a plain list of the stages is shown instead. */
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

const Person = ({ label, name, bg, fg }: { label: string; name: string; bg: string; fg: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold" style={{ background: bg, color: fg }}>{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
    {label} <b className="text-on-surface">{name}</b>
  </span>
)

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
        <p className="m-0 text-[19px] font-semibold leading-relaxed"><Terms text={proc.nutshell} /></p>
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
      {(proc.exceptions?.length ?? 0) > 0 && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5"><Undo2 size={22} className="text-[#EA580C]" aria-hidden /><h3 className="m-0 text-[17px] font-extrabold">What if…?</h3><span className="text-sm text-on-surface-variant">When things don't go to plan</span></div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
            {proc.exceptions!.map((x, k) => (
              <div key={k} className="flex flex-col gap-1 rounded-[16px] bg-[#FFF7E6] px-3.5 py-3 text-sm">
                <b><Terms text={x.case} /></b>
                {x.handled && <span className="text-[13px] text-[#7A3A00]">→ <Terms text={x.handled} /></span>}
              </div>
            ))}
          </div>
        </Card>
      )}
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
          <div className="flex flex-wrap gap-2">{systems.length ? systems.map((s) => <Tag key={s} className="bg-ink text-white">{sysLabel(s)}</Tag>) : <span className="text-sm text-on-surface-variant">None listed yet</span>}</div>
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
