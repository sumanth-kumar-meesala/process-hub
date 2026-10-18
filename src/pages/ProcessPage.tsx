import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, MousePointerClick, Pencil, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import Islands3D from '@/three/Islands3D'
import { canEdit, useData, useSession } from '@/store/store'
import { stageRoles } from '@/lib/derive'
import type { Process } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useGuide } from '@/lib/guide'
import { AboutProcess } from '@/components/process/AboutProcess'
import { ProcessChat } from '@/components/process/ProcessChat'
import { ProcessHeader } from '@/components/process/ProcessHeader'
import { StageSidePanel } from '@/components/process/StageSidePanel'

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
  const { persona } = useSession()
  const library = useData((s) => s.library)
  const can3d = useMemo(hasWebGL, [])
  const nav = useNavigate()
  const [hover, setHover] = useState<number | null>(null)
  // map view: zoom and tilt steps from the buttons; it starts a little tilted (more from the side). Reset also re-centres after dragging.
  const DEFAULT_TILT = -1
  const [zoom, setZoom] = useState(0)
  const [tilt, setTilt] = useState(DEFAULT_TILT)
  const [resetKey, setResetKey] = useState(0)
  // the stage shown in the side panel: always one, starting with the first (or the first that's part of the chosen role's work)
  const firstFor = (role: string | null) => Math.max(0, proc.stages.findIndex((s) => !role || stageRoles(proc, s).some((r) => r.id === role)))
  const [sel, setSel] = useState(() => firstFor(null))
  const [params] = useSearchParams()
  // the same "Show steps for" and saved progress as the step-by-step guide
  const run = useGuide(proc, library)
  const n = proc.stages.length
  // choosing a stage opens its first step (the reader's own, if they have one there) — the same "where you are" as the Timeline
  const openStage = (k: number) => {
    const kk = Math.max(0, Math.min(n - 1, k)); setSel(kk)
    const st = run.g.stages[kk]
    if (st && run.cur?.stageIdx !== kk) { const x = st.usual.find((y) => y.mine) ?? st.mine[0] ?? st.all[0]; if (x) run.select(x.st.id) }
  }
  // Done / Yes / No can move on to another stage: the panel follows
  useEffect(() => { if (run.cur && !run.finished) setSel(run.cur.stageIdx) }, [run.cur?.st.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // choosing someone in "Show steps for" moves the panel to their first stage
  useEffect(() => { setSel(firstFor(run.role)) }, [run.role]) // eslint-disable-line react-hooks/exhaustive-deps

  // "One question to start" on the home page sends people here with ?as=<role>
  useEffect(() => {
    const as = params.get('as')
    const r = as && proc.roles.find((x) => x.id === as || x.name.toLowerCase() === as.toLowerCase())
    if (r && run.role !== r.id) run.setRole(r.id)
  }, [params, proc.roles]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-full">
      <AppHeader>
        {canEdit(persona, proc) && <Button variant="outlined" size="sm" onClick={() => nav(`/builder/${proc.id}`)}><Pencil size={15} />Edit in Builder</Button>}
      </AppHeader>
      <ProcessHeader proc={proc} run={run} current="3d" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-5 px-3 pb-4 pt-1 sm:px-6">
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
          {n === 0 ? (
            <p className="relative z-[1] m-0 rounded-[20px] bg-white p-6 text-sm text-on-surface-variant">The owner hasn't added stages yet.</p>
          ) : (
            <div className="relative z-[1] flex flex-col gap-2">
              {!can3d && <p className="m-0 text-sm font-semibold text-on-surface-variant">Choose a stage to see its steps.</p>}
              {can3d ? (
                <>
                {/* the hint sits above the map, never on top of an island */}
                <p className="m-0 inline-flex items-center gap-2 text-[13px] font-semibold text-on-surface-variant">
                  <MousePointerClick size={14} aria-hidden />{run.roleObj ? <><b className="text-on-surface">{run.roleObj.name}</b>'s stages are highlighted · click a stage to see its steps</> : 'Click a stage to see its steps'} · drag to move the map
                </p>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
                  <div className="relative -mx-2 h-[min(clamp(360px,36vw,520px),calc(100vh-300px))] min-h-[340px] max-sm:h-[420px]">
                    <Islands3D process={proc} active={sel} quiet zoomLevel={zoom} tilt={tilt} resetKey={resetKey} onSelect={openStage} hover={hover} onHover={setHover} roleFilter={run.role} />
                    <div role="group" aria-label="Map view" className="glass absolute bottom-3 left-3 z-[40] flex items-center gap-0 rounded-full p-0.5">
                      <MapBtn label="Zoom out" disabled={zoom <= -3} onClick={() => setZoom((z) => z - 1)}><ZoomOut size={15} /></MapBtn>
                      <MapBtn label="Zoom in" disabled={zoom >= 4} onClick={() => setZoom((z) => z + 1)}><ZoomIn size={15} /></MapBtn>
                      <span className="mx-0.5 h-4 w-px bg-outline-variant" aria-hidden />
                      <MapBtn label="Tilt down (more from the side)" disabled={tilt <= -2} onClick={() => setTilt((t) => t - 1)}><ChevronDown size={15} /></MapBtn>
                      <MapBtn label="Tilt up (more from above)" disabled={tilt >= 4} onClick={() => setTilt((t) => t + 1)}><ChevronUp size={15} /></MapBtn>
                      <span className="mx-0.5 h-4 w-px bg-outline-variant" aria-hidden />
                      <MapBtn label="Reset the view" onClick={() => { setZoom(0); setTilt(DEFAULT_TILT); setResetKey((k) => k + 1) }}><RotateCcw size={14} /></MapBtn>
                    </div>
                  </div>
                  <div className="h-[min(clamp(360px,36vw,520px),calc(100vh-300px))] min-h-[340px] max-lg:h-auto">
                    <StageSidePanel proc={proc} run={run} k={sel} onStage={openStage} />
                  </div>
                </div>
                </>
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
                  <StageSidePanel proc={proc} run={run} k={sel} onStage={openStage} />
                </>
              )}
            </div>
          )}
        </section>

      </main>
      <AboutProcess proc={proc} />
      <ProcessChat proc={proc} onShowStage={openStage} />
    </div>
  )
}

/** Can this browser draw 3D? If not, a plain list of the stages is shown instead. */
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

/** A small round button in the map's zoom, tilt and reset controls. */
const MapBtn = ({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-on-surface hover:bg-white disabled:cursor-default disabled:opacity-35">{children}</button>
)
