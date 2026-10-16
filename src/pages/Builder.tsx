import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ReactFlow, ReactFlowProvider, Background, Handle, Position, MarkerType, useNodesState, useReactFlow,
  type Node, type Edge as RFEdge, type NodeProps, type Connection, type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, Box, CircleDot, Diamond, Eye, FileText, Flag, Maximize, Minus, Monitor, Plus, RotateCcw, Send, Sparkles, Trash2, Trophy, User, Users, LayoutGrid, ChevronLeft, ChevronRight, Check,
} from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import Islands3D from '@/three/Islands3D'
import { canBuild, canEdit, personaUser, useData, useSession } from '@/store/store'
import { ROLE_COLORS, STAGE_COLORS, tint, uid, type Process, type SceneKind, type StepKind } from '@/lib/types'
import { displayName, stepCount } from '@/lib/derive'
import { applyOps, summariseNotes, type Op } from '@/ai/ops'
import { askGroq, foldHistory, buildMessages, INPUT_BUDGET, type ChatMsg } from '@/ai/groq'
import { cn } from '@/lib/utils'

/* ---------- layout grid: columns = stages, rows (lanes) = roles ---------- */
const LBL = 150, COL = 250, HDR = 56, LANE = 112, NW = 156, NH = 50, CW = 34
const widthOf = (k: StepKind) => (k === 'start' || k === 'end' ? CW : NW)

/* ===================================================================== */
export default function Builder() {
  const { id } = useParams()
  const { persona } = useSession()
  const processes = useData((s) => s.processes)
  const hydrated = useData((s) => s.hydrated)
  if (!canBuild(persona)) return (
    <div><AppHeader />
      <div className="mx-auto max-w-[640px] p-10"><div className="rounded-[24px] bg-white p-8">
        <h1 className="m-0 mb-2 text-2xl font-extrabold">The Builder is for Process Owners</h1>
        <p className="m-0 text-on-surface-variant">Only Process Owners and the Global Admin can create or change processes. For this prototype, switch “I am” at the top to Process Owner or Global Admin.</p>
      </div></div>
    </div>
  )
  if (!id) return <BuilderHome />
  const proc = processes.find((p) => p.id === id)
  if (!proc) return <div><AppHeader /><p className="p-10">{hydrated ? 'Process not found.' : 'Loading…'}</p></div>
  if (!canEdit(persona, proc)) return (
    <div><AppHeader /><div className="mx-auto max-w-[640px] p-10"><div className="rounded-[24px] bg-white p-8">
      <h1 className="m-0 mb-2 text-2xl font-extrabold">You can't edit this one</h1>
      <p className="m-0 text-on-surface-variant">{displayName(proc)} is owned by {proc.owner}. Process Owners can edit their own processes; the Global Admin can edit all.</p>
    </div></div></div>
  )
  return <ReactFlowProvider><Editor key={proc.id} initial={proc} /></ReactFlowProvider>
}

function BuilderHome() {
  const { persona } = useSession()
  const processes = useData((s) => s.processes)
  const upsert = useData((s) => s.upsert)
  const nav = useNavigate()
  const mine = processes.filter((p) => canEdit(persona, p))
  const create = () => {
    const id = `process-${Date.now().toString(36)}`
    const p: Process = {
      id, title: 'New process', area: 'Client & Community', summary: '', nutshell: '', owner: personaUser(persona), status: 'draft', needsCompleting: false,
      triggers: [], outcomes: [], roles: [{ id: 'r1', name: 'Requester', color: ROLE_COLORS[0] }],
      stages: [{ id: 's1', title: 'First stage', short: 'Stage 1', place: '', text: '', color: STAGE_COLORS[0], systems: [], docs: [], roleIds: [], scene: 'auto' }],
      steps: [{ id: 'start', kind: 'start', label: 'It starts', roleId: 'r1', stageId: 's1' }], edges: [], resources: [], roleDetails: [], updatedAt: new Date().toISOString(),
    }
    upsert(p); nav(`/builder/${id}`)
  }
  return (
    <div className="min-h-full"><AppHeader />
      <main className="mx-auto flex max-w-[880px] flex-col gap-5 px-4 pb-16 pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 flex-1 text-3xl font-extrabold">Builder</h1>
          <Button onClick={create}><Plus size={16} />New process</Button>
        </div>
        <p className="m-0 text-on-surface-variant">{persona === 'admin' ? 'As Global Admin you can edit every process.' : 'Processes you own. Start a new one, or describe it to the AI assistant inside.'}</p>
        <div className="flex flex-col gap-2.5">
          {mine.length === 0 && <p className="rounded-[20px] bg-white p-6 text-on-surface-variant">You don't own any processes yet.</p>}
          {mine.map((p) => (
            <Link key={p.id} to={`/builder/${p.id}`} className="flex items-center gap-4 rounded-[20px] bg-white px-6 py-4 text-on-surface no-underline hover:shadow-md">
              <LayoutGrid size={22} className="text-primary" aria-hidden />
              <span className="flex flex-1 flex-col"><b>{displayName(p)}</b><span className="text-[13px] text-on-surface-variant">{p.owner} · {p.stages.length} stages · {stepCount(p)} steps</span></span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', p.status === 'published' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-mid')}>{p.status === 'published' ? 'Published' : 'Draft'}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}

/* ---------- custom nodes ---------- */
type StepData = { label: string; kind: StepKind; color: string; stageNo: number; suggested: boolean; selected?: boolean }
type GridData = { stages: Process['stages']; roles: Process['roles']; w: number; h: number; onStage: (id: string) => void; selStage?: string }

const handles = (
  <>
    <Handle type="target" position={Position.Left} id="l" />
    <Handle type="source" position={Position.Right} id="r" />
    <Handle type="target" position={Position.Top} id="t" />
    <Handle type="source" position={Position.Bottom} id="b" />
  </>
)

function StepNode({ data, selected }: NodeProps<Node<StepData>>) {
  const ring = selected ? '0 0 0 2px #1D4ED8, 0 0 0 6px #DFE7FF' : '0 1px 2px rgba(15,23,42,.06), 0 4px 12px rgba(15,23,42,.08)'
  if (data.kind === 'decision') return (
    <div className="relative flex items-center justify-center" style={{ width: NW, height: NH }}>
      <div className="absolute h-[46px] w-[46px] rotate-45 rounded-[10px]" style={{ background: data.suggested ? '#F2F5FF' : '#fff', boxShadow: ring, outline: data.suggested ? '1.5px dashed #1D4ED8' : undefined }} />
      <span className="relative max-w-[150px] text-center text-[11px] font-extrabold leading-tight">{data.label}</span>
      {handles}
    </div>
  )
  if (data.kind === 'start' || data.kind === 'end') return (
    <div className="relative flex items-center justify-center" style={{ width: CW, height: NH }} title={data.label}>
      <span className="h-[30px] w-[30px] rounded-full bg-white" style={{ border: data.kind === 'start' ? '3px solid #15803D' : '7px solid #0F766E', boxShadow: selected ? '0 0 0 4px #DFE7FF' : undefined }} />
      <span className="absolute left-1/2 top-[44px] w-[110px] -translate-x-1/2 text-center text-[10px] font-bold leading-tight text-on-surface-variant">{data.label}</span>
      {handles}
    </div>
  )
  return (
    <div className="flex items-center gap-2 rounded-[14px] px-2.5 text-xs font-bold leading-tight"
      style={{ width: NW, height: NH, background: data.suggested ? '#F2F5FF' : '#fff', boxShadow: data.suggested ? 'none' : ring, outline: data.suggested ? '1.5px dashed #1D4ED8' : undefined, color: data.suggested ? '#0A2472' : undefined }}>
      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: data.color }}>{data.stageNo}</span>
      {data.label}
      {data.suggested && <span className="absolute -top-2.5 left-2 rounded-full bg-primary px-2 py-px text-[9px] font-extrabold text-white">AI suggestion</span>}
      {handles}
    </div>
  )
}

function GridNode({ data }: NodeProps<Node<GridData>>) {
  return (
    <div style={{ width: data.w, height: data.h, pointerEvents: 'none' }} className="relative">
      {data.stages.map((s, i) => (
        <div key={s.id} className="absolute top-0" style={{ left: LBL + i * COL, width: COL, height: data.h, background: tint(s.color, 0.06) }}>
          <button onClick={() => data.onStage(s.id)} style={{ pointerEvents: 'auto', background: s.color, boxShadow: data.selStage === s.id ? '0 0 0 3px #fff, 0 0 0 5px ' + s.color : undefined }}
            className="nodrag absolute left-2 right-2 top-2.5 h-8 cursor-pointer truncate rounded-full border-0 px-3 text-xs font-extrabold text-white">{i + 1} · {s.short}</button>
        </div>
      ))}
      {data.roles.map((r, j) => (
        <div key={r.id} className="absolute left-0 flex items-center gap-2 border-t border-outline-variant pl-3 text-xs font-bold" style={{ top: HDR + j * LANE, width: data.w, height: LANE }}>
          <span className="h-3 w-3 flex-none rounded-full" style={{ background: r.color }} /><span className="w-[120px] leading-tight">{r.name}</span>
        </div>
      ))}
    </div>
  )
}
const nodeTypes = { step: StepNode, grid: GridNode }

/* ---------- helpers ---------- */
const cellOf = (p: Process, x: number, y: number) => {
  const si = Math.max(0, Math.min(p.stages.length - 1, Math.floor((x - LBL) / COL)))
  const ri = Math.max(0, Math.min(p.roles.length - 1, Math.floor((y - HDR) / LANE)))
  return { stage: p.stages[si], role: p.roles[ri] }
}

function computeNodes(p: Process, added: Set<string>, selStage?: string, onStage?: (id: string) => void): Node[] {
  const w = LBL + Math.max(1, p.stages.length) * COL + 40, h = HDR + Math.max(1, p.roles.length) * LANE
  const grid: Node<GridData> = { id: '__grid', type: 'grid', position: { x: 0, y: 0 }, data: { stages: p.stages, roles: p.roles, w, h, onStage: onStage ?? (() => {}), selStage }, draggable: false, selectable: false, zIndex: -1, style: { pointerEvents: 'none' } }
  // items sharing a cell sit side by side (start/end markers are narrow); wrap if the cell is full
  const perCell: Record<string, { x: number; row: number }> = {}
  const order = [...p.steps].sort((a, b) => (a.kind === 'start' ? -1 : a.kind === 'end' ? 1 : 0) - (b.kind === 'start' ? -1 : b.kind === 'end' ? 1 : 0))
  const pos: Record<string, { x: number; y: number }> = {}
  order.forEach((s) => {
    const si = Math.max(0, p.stages.findIndex((x) => x.id === s.stageId)), ri = Math.max(0, p.roles.findIndex((x) => x.id === s.roleId))
    const key = `${si}-${ri}`, w = widthOf(s.kind)
    const c = perCell[key] ?? { x: 14, row: 0 }
    if (c.x + w > COL - 8 && c.x > 14) { c.x = 14; c.row++ }
    pos[s.id] = { x: LBL + si * COL + c.x + c.row * 10, y: HDR + ri * LANE + (LANE - NH) / 2 + c.row * 16 }
    c.x += w + 14; perCell[key] = c
  })
  const steps: Node<StepData>[] = p.steps.map((s) => {
    const si = p.stages.findIndex((x) => x.id === s.stageId)
    const def = pos[s.id]
    const saved = p.layout?.[s.id]
    const inCell = saved && cellOf(p, saved.x + widthOf(s.kind) / 2, saved.y + NH / 2).stage?.id === s.stageId && cellOf(p, saved.x + widthOf(s.kind) / 2, saved.y + NH / 2).role?.id === s.roleId
    const st = p.stages[si]
    return { id: s.id, type: 'step', position: inCell ? saved! : def, data: { label: s.label, kind: s.kind, color: st?.color ?? '#64748B', stageNo: si + 1, suggested: added.has(s.id) } }
  })
  return [grid, ...steps]
}

const computeEdges = (p: Process, added: Set<string>): RFEdge[] => p.edges.map((e) => ({
  id: e.id, source: e.from, target: e.to, sourceHandle: 'r', targetHandle: 'l', label: e.label, type: 'smoothstep',
  animated: added.has(e.from) || added.has(e.to),
  style: { stroke: added.has(e.from) || added.has(e.to) ? '#1D4ED8' : '#4A5163', strokeWidth: 1.8, strokeDasharray: e.label === 'No' ? '5 4' : undefined },
  labelStyle: { fontWeight: 800, fontSize: 11, fill: e.label === 'No' ? '#B42318' : '#15803D' },
  labelBgStyle: { fill: '#fff' }, labelBgPadding: [4, 2] as [number, number], labelBgBorderRadius: 6,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#4A5163', width: 16, height: 16 },
}))

const NONE = new Set<string>()
type Sel = { type: 'step' | 'edge' | 'stage'; id: string } | null
type Pending = { ops: Op[]; reply: string; notes: string[]; preview: Process; added: Set<string> }

/* ===================================================================== */
function Editor({ initial }: { initial: Process }) {
  const { persona, groqKey, model } = useSession()
  const upsert = useData((s) => s.upsert)
  const nav = useNavigate()
  const rf = useReactFlow()
  const [draft, setDraft] = useState<Process>(initial)
  const undoStack = useRef<Process[]>([])
  const [sel, setSel] = useState<Sel>(null)
  const [tab, setTab] = useState<'ai' | 'details' | 'process'>('ai')
  const [chat, setChat] = useState<(ChatMsg & { applied?: string })[]>([])
  const [summary, setSummary] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState(true)

  const commit = useCallback((fn: (d: Process) => Process) => {
    setDraft((d) => { undoStack.current.push(d); if (undoStack.current.length > 50) undoStack.current.shift(); return fn(structuredClone(d)) })
  }, [])
  const undo = () => { const prev = undoStack.current.pop(); if (prev) setDraft(prev) }

  // auto-save to the in-browser database
  useEffect(() => {
    setSaved(false)
    const t = setTimeout(() => { upsert(draft); setSaved(true) }, 350)
    return () => clearTimeout(t)
  }, [draft, upsert])

  const view = pending?.preview ?? draft
  const added = pending?.added ?? NONE
  const onStage = useCallback((id: string) => { setSel({ type: 'stage', id }); setTab('details') }, [])
  const selStage = sel?.type === 'stage' ? sel.id : undefined
  const built = useMemo(() => computeNodes(view, added, selStage, onStage), [view, added, selStage, onStage])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(built)
  useEffect(() => { setNodes(built) }, [built, setNodes])
  const edges = useMemo(() => computeEdges(view, added), [view, added])

  /* --- canvas interactions --- */
  const onNodeDragStop = (_: unknown, n: Node) => {
    if (pending) return
    const { stage, role } = cellOf(draft, n.position.x + (n.width ?? NW) / 2, n.position.y + NH / 2)
    commit((d) => {
      const s = d.steps.find((x) => x.id === n.id); if (!s || !stage || !role) return d
      s.stageId = stage.id; s.roleId = role.id
      d.layout = { ...(d.layout ?? {}), [n.id]: n.position }
      return d
    })
  }
  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || pending) return
    commit((d) => {
      if (!d.edges.some((e) => e.from === c.source && e.to === c.target)) {
        const fromDecision = d.steps.find((s) => s.id === c.source)?.kind === 'decision'
        const hasYes = d.edges.some((e) => e.from === c.source && e.label === 'Yes')
        d.edges.push({ id: uid('e'), from: c.source!, to: c.target!, label: fromDecision ? (hasYes ? 'No' : 'Yes') : undefined })
      }
      return d
    })
  }
  const removeStep = (id: string) => commit((d) => ({ ...d, steps: d.steps.filter((s) => s.id !== id), edges: d.edges.filter((e) => e.from !== id && e.to !== id) }))
  const onNodesChangeSafe = (ch: NodeChange[]) => onNodesChange(ch.filter((c) => !(c.type === 'remove' && c.id === '__grid')))

  const addAt = (kind: string, x?: number, y?: number) => {
    if (pending) return
    if (kind === 'role') return commit((d) => { d.roles.push({ id: uid('r'), name: `New role ${d.roles.length + 1}`, color: ROLE_COLORS[d.roles.length % ROLE_COLORS.length] }); return d })
    if (kind === 'stage') return commit((d) => { const id = uid('s'); d.stages.push({ id, title: 'New stage', short: `Stage ${d.stages.length + 1}`, place: '', text: '', color: STAGE_COLORS[d.stages.length % STAGE_COLORS.length], systems: [], docs: [], roleIds: [], scene: 'auto' }); setTimeout(() => onStage(id)); return d })
    const px = x ?? LBL + (draft.stages.findIndex((s) => s.id === selStage) >= 0 ? draft.stages.findIndex((s) => s.id === selStage) : 0) * COL + COL / 2
    const py = y ?? HDR + LANE / 2
    const { stage, role } = cellOf(draft, px, py)
    if (!stage || !role) return
    if (kind === 'system' || kind === 'document') {
      commit((d) => { const s = d.stages.find((q) => q.id === stage.id)!; (kind === 'system' ? s.systems : s.docs).push(kind === 'system' ? 'New system' : 'New document'); return d })
      return onStage(stage.id)
    }
    const k = kind as StepKind
    const id = uid('st')
    commit((d) => {
      d.steps.push({ id, kind: k, label: k === 'decision' ? 'Question?' : k === 'start' ? 'It starts' : k === 'end' ? "It's done" : 'New step', roleId: role.id, stageId: stage.id })
      if (x !== undefined && y !== undefined) d.layout = { ...(d.layout ?? {}), [id]: { x: x - NW / 2, y: y - NH / 2 } }
      return d
    })
    setSel({ type: 'step', id }); setTab('details')
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const kind = e.dataTransfer.getData('application/ph'); if (!kind) return
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addAt(kind, p.x, p.y)
  }

  /* --- AI --- */
  const send = async (text: string) => {
    if (!text.trim() || busy) return
    if (!groqKey) { setErr('No Groq key yet. The Global Admin adds it in Admin → AI assistant.'); return }
    setErr(''); setBusy(true); setMsg('')
    const history: ChatMsg[] = [...chat.map(({ role, content }) => ({ role, content })), { role: 'user', content: text }]
    setChat((c) => [...c, { role: 'user', content: text }])
    try {
      const r = await askGroq({ key: groqKey, model, process: draft, history, summary })
      setSummary(r.summary)
      setChat((c) => [...c, { role: 'assistant', content: r.reply }])
      if (r.ops.length) {
        const { next, added, notes } = applyOps(draft, r.ops)
        setPending({ ops: r.ops, reply: r.reply, notes, preview: next, added })
      }
    } catch (e) {
      setErr((e as Error).message || 'Something went wrong talking to Groq.')
    } finally { setBusy(false) }
  }
  const applyPending = () => {
    if (!pending) return
    const label = summariseNotes(pending.notes)
    commit(() => pending.preview)
    setChat((c) => { const x = [...c]; for (let i = x.length - 1; i >= 0; i--) if (x[i].role === 'assistant') { x[i] = { ...x[i], applied: label }; break } return x })
    setPending(null)
  }
  const memory = useMemo(() => {
    const { recent, summary: s } = foldHistory(chat.map(({ role, content }) => ({ role, content })), summary)
    return buildMessages(draft, recent, s).tokens
  }, [chat, summary, draft])

  const publish = () => commit((d) => ({ ...d, status: d.status === 'published' ? 'draft' : 'published' }))
  const stageSel = sel?.type === 'stage' ? draft.stages.find((s) => s.id === sel.id) : undefined
  const stepSel = sel?.type === 'step' ? draft.steps.find((s) => s.id === sel.id) : undefined
  const edgeSel = sel?.type === 'edge' ? draft.edges.find((e) => e.id === sel.id) : undefined

  return (
    <div className="flex h-screen min-h-[720px] flex-col bg-surface">
      <header className="flex flex-wrap items-center gap-2.5 border-b border-outline-variant bg-white px-4 py-2.5">
        <Button variant="icon" size="icon" aria-label="Back" onClick={() => nav('/builder')}><ArrowLeft size={20} /></Button>
        {draft.code && <span className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[13px] font-extrabold text-white">{draft.code}</span>}
        <div className="flex flex-col leading-tight">
          <label htmlFor="pname" className="sr-only">Process name</label>
          <input id="pname" value={draft.title} onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, title: v })) }} className="w-[260px] border-0 bg-transparent p-0 text-[17px] font-extrabold outline-none" />
          <span className="text-xs text-on-surface-variant">{draft.status === 'published' ? 'Published' : 'Draft'} · {saved ? 'saved in this browser' : 'saving…'}</span>
        </div>
        <div className="flex-1" />
        <span className="inline-flex h-9 items-center gap-2 rounded-full bg-secondary-container py-0 pl-1.5 pr-3 text-[13px] font-bold text-on-secondary-container">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-secondary text-[11px] text-white">{personaUser(persona).split(' ').map((w) => w[0]).join('')}</span>
          {personaUser(persona)} · {persona === 'admin' ? 'Global admin' : 'Process owner'}
        </span>
        <Button variant="icon" size="icon" aria-label="Undo" onClick={undo} disabled={!undoStack.current.length}><RotateCcw size={18} /></Button>
        <Button variant="outlined" size="sm" onClick={() => { upsert(draft); nav(`/process/${draft.id}`) }}><Eye size={16} />View as user</Button>
        <Button size="sm" onClick={publish}>{draft.status === 'published' ? 'Unpublish' : 'Publish'}</Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* palette */}
        <aside className="flex w-[216px] flex-none flex-col gap-4 overflow-y-auto border-r border-outline-variant bg-white p-4">
          <b className="text-[15px]">Elements</b>
          <Palette title="Who" items={[['role', 'Role', User, '#F97316'], ['team', 'Team', Users, '#F97316']]} onAdd={(k) => addAt(k === 'team' ? 'role' : k)} />
          <Palette title="Flow" items={[['start', 'Trigger', Flag, '#2563EB'], ['stage', 'Stage', LayoutGrid, '#DB2777'], ['step', 'Step', Box, '#151A25'], ['decision', 'Decision', Diamond, '#151A25'], ['end', 'Outcome', Trophy, '#0F766E']]} onAdd={addAt} />
          <Palette title="Used along the way" items={[['system', 'System', Monitor, '#7C3AED'], ['document', 'Document', FileText, '#7C3AED']]} onAdd={addAt} />
          <p className="m-0 text-xs leading-normal text-on-surface-variant">Drag onto the canvas, or click to add. Each one becomes part of the 3D islands automatically.</p>
        </aside>

        {/* canvas */}
        <section className="relative min-w-0 flex-1" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }} onDrop={onDrop}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChangeSafe}
            onNodeDragStop={onNodeDragStop} onConnect={onConnect}
            onNodeClick={(_, n) => { if (n.id !== '__grid') { setSel({ type: 'step', id: n.id }); setTab('details') } }}
            onEdgeClick={(_, e) => { setSel({ type: 'edge', id: e.id }); setTab('details') }}
            onPaneClick={() => setSel(null)}
            onNodesDelete={(ns) => ns.forEach((n) => n.id !== '__grid' && removeStep(n.id))}
            onEdgesDelete={(es) => commit((d) => ({ ...d, edges: d.edges.filter((e) => !es.some((x) => x.id === e.id)) }))}
            deleteKeyCode={['Backspace', 'Delete']} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.3} maxZoom={2}>
            <Background gap={20} size={1.2} color="#C9CFDD" />
          </ReactFlow>
          <div className="glass absolute bottom-4 left-4 z-10 flex items-center gap-0.5 rounded-full p-1">
            <Button variant="icon" size="icon" aria-label="Zoom out" onClick={() => rf.zoomOut()}><Minus size={18} /></Button>
            <Button variant="icon" size="icon" aria-label="Zoom in" onClick={() => rf.zoomIn()}><Plus size={18} /></Button>
            <Button variant="icon" size="icon" aria-label="Fit to screen" onClick={() => rf.fitView({ padding: 0.12 })}><Maximize size={18} /></Button>
          </div>
          <div className="glass absolute bottom-4 right-4 z-10 flex w-[300px] flex-col gap-1 rounded-[22px] px-3.5 pb-2.5 pt-3">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-secondary" /><b className="text-[13px]">Live 3D preview</b><div className="flex-1" />{pending && <span className="rounded-full bg-primary px-2 text-[10px] font-extrabold text-white">with AI change</span>}</div>
            <div className="h-[130px]"><Islands3D process={view} active={0} compact /></div>
            <span className="text-[11px] text-on-surface-variant">{view.stages.length} islands · {view.roles.length} roles · {stepCount(view)} steps — updates as you build</span>
          </div>
        </section>

        {/* right panel */}
        <aside className="flex w-[370px] flex-none flex-col border-l border-outline-variant bg-white">
          <div className="flex items-center gap-1 border-b border-outline-variant px-3 py-2.5">
            {(['ai', 'details', 'process'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn('h-9 cursor-pointer rounded-full border-0 px-3.5 text-[13px] font-bold', tab === t ? 'bg-on-surface text-white' : 'bg-transparent text-on-surface-variant hover:bg-surface-low')}>
                {t === 'ai' ? 'AI assistant' : t === 'details' ? 'Details' : 'Process'}
              </button>
            ))}
            <div className="flex-1" />
            {tab === 'ai' && <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-surface-low px-2.5 text-xs font-bold"><span className={cn('h-1.5 w-1.5 rounded-full', groqKey ? 'bg-secondary' : 'bg-outline')} />Groq</span>}
          </div>

          {tab === 'ai' && (
            <>
              <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4">
                {chat.length === 0 && (
                  <div className="rounded-[18px] bg-surface-low p-4 text-sm leading-relaxed">
                    <div className="mb-1 flex items-center gap-2 font-extrabold"><Sparkles size={16} className="text-secondary" />Describe it in your words</div>
                    Tell me who does what and in what order — I'll suggest stages, steps and decisions. You can review every change before it's applied.
                  </div>
                )}
                {chat.map((m, k) => m.role === 'user'
                  ? <div key={k} className="max-w-[88%] self-end rounded-[18px_18px_4px_18px] bg-primary px-3.5 py-3 text-sm leading-normal text-white">{m.content}</div>
                  : (
                    <div key={k} className="flex max-w-[94%] flex-col gap-2">
                      <div className="rounded-[18px_18px_18px_4px] bg-surface-low px-3.5 py-3 text-sm leading-normal">{m.content}</div>
                      {m.applied && <div className="flex items-center gap-2 rounded-[14px] bg-[#F1FAF4] px-3 py-2.5 text-[13px]"><Check size={16} className="text-secondary" /><span><b>Applied</b> · {m.applied}</span></div>}
                    </div>
                  ))}
                {busy && <div className="w-fit rounded-[18px] bg-surface-low px-4 py-3 text-sm text-on-surface-variant">Thinking…</div>}
                {pending && (
                  <div className="flex flex-col gap-2.5 rounded-2xl bg-[#F2F5FF] p-3.5">
                    <div className="text-[13px] leading-normal"><b>{summariseNotes(pending.notes)}</b><span className="text-on-surface-variant"> — shown dashed on the canvas</span></div>
                    <ul className="m-0 max-h-[120px] list-none overflow-y-auto p-0 text-xs text-on-surface-variant">{pending.notes.slice(0, 12).map((n, k) => <li key={k}>{n}</li>)}</ul>
                    <div className="flex gap-2"><Button className="flex-1" size="sm" onClick={applyPending}>Apply</Button><Button className="flex-1" size="sm" variant="outlined" onClick={() => setPending(null)}>Discard</Button></div>
                  </div>
                )}
                {err && <div className="rounded-[14px] bg-error-container px-3.5 py-3 text-[13px] text-error">{err}{!groqKey && persona === 'admin' && <> <Link to="/admin">Open Admin</Link></>}</div>}
                {!busy && !pending && (
                  <div className="flex flex-wrap gap-1.5">
                    {['Add the triggers', 'Rewrite steps in plain words', 'Is anything missing?'].map((q) => <button key={q} onClick={() => send(q)} className="h-8 cursor-pointer rounded-full border border-outline-variant bg-white px-3 text-xs font-semibold hover:bg-surface-low">{q}</button>)}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2.5 border-t border-outline-variant px-4 pb-4 pt-3">
                <div className="flex items-center gap-2.5 text-xs text-on-surface-variant" title="How much of the AI's per-request budget this chat uses. Older messages are summarised automatically.">
                  <span className="whitespace-nowrap">Memory {(memory / 1000).toFixed(1)}k / {INPUT_BUDGET / 1000}k</span>
                  <span className="h-1.5 flex-1 rounded bg-surface-mid"><span className="block h-1.5 rounded bg-secondary" style={{ width: `${Math.min(100, (memory / INPUT_BUDGET) * 100)}%` }} /></span>
                  <span className="whitespace-nowrap">{chat.length > 6 ? 'older chat summarised' : 'full chat'}</span>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); send(msg); setMsg('') }} className="flex min-h-[52px] items-center gap-2 rounded-full bg-surface-low pl-4 pr-1.5">
                  <label htmlFor="aimsg" className="sr-only">Message the AI assistant</label>
                  <input id="aimsg" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Describe a change in your words…" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" disabled={busy} />
                  <button type="submit" aria-label="Send" disabled={busy} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-primary disabled:opacity-50"><Send size={17} color="#fff" /></button>
                </form>
              </div>
            </>
          )}

          {tab === 'details' && (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {!sel && <p className="m-0 rounded-[18px] bg-surface-low p-4 text-sm text-on-surface-variant">Click a step, a link, or a stage header on the canvas to edit it here.</p>}
              {stepSel && (
                <>
                  <h3 className="m-0 text-base font-extrabold">{stepSel.kind === 'decision' ? 'Decision' : stepSel.kind === 'start' ? 'Trigger' : stepSel.kind === 'end' ? 'Outcome' : 'Step'}</h3>
                  <Field label="What happens (plain words)"><input className={inputCls} value={stepSel.label} onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, steps: d.steps.map((s) => s.id === stepSel.id ? { ...s, label: v } : s) })) }} /></Field>
                  <Field label="Type"><select className={inputCls} value={stepSel.kind} onChange={(e) => commit((d) => { d.steps.find((s) => s.id === stepSel.id)!.kind = e.target.value as StepKind; return d })}>
                    <option value="step">Step</option><option value="decision">Decision (yes / no)</option><option value="start">Trigger (start)</option><option value="end">Outcome (end)</option></select></Field>
                  <Field label="Who does it"><select className={inputCls} value={stepSel.roleId} onChange={(e) => commit((d) => { d.steps.find((s) => s.id === stepSel.id)!.roleId = e.target.value; return d })}>
                    {draft.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
                  <Field label="Stage"><select className={inputCls} value={stepSel.stageId} onChange={(e) => commit((d) => { d.steps.find((s) => s.id === stepSel.id)!.stageId = e.target.value; return d })}>
                    {draft.stages.map((s, i) => <option key={s.id} value={s.id}>{i + 1} · {s.short}</option>)}</select></Field>
                  <Button variant="danger" size="sm" className="self-start" onClick={() => { removeStep(stepSel.id); setSel(null) }}><Trash2 size={15} />Delete</Button>
                  <p className="m-0 text-xs text-on-surface-variant">Tip: drag from the dot on a step's right edge to another step to connect them.</p>
                </>
              )}
              {edgeSel && (
                <>
                  <h3 className="m-0 text-base font-extrabold">Link</h3>
                  <p className="m-0 text-sm">{draft.steps.find((s) => s.id === edgeSel.from)?.label} → {draft.steps.find((s) => s.id === edgeSel.to)?.label}</p>
                  <Field label="Label (e.g. Yes / No)"><input className={inputCls} value={edgeSel.label ?? ''} onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, edges: d.edges.map((x) => x.id === edgeSel.id ? { ...x, label: v || undefined } : x) })) }} /></Field>
                  <Button variant="danger" size="sm" className="self-start" onClick={() => { commit((d) => ({ ...d, edges: d.edges.filter((x) => x.id !== edgeSel.id) })); setSel(null) }}><Trash2 size={15} />Remove link</Button>
                </>
              )}
              {stageSel && <StageEditor proc={draft} stageId={stageSel.id} setDraft={setDraft} commit={commit} onDeleted={() => setSel(null)} />}
            </div>
          )}

          {tab === 'process' && <ProcessEditor proc={draft} setDraft={setDraft} commit={commit} admin={persona === 'admin'} />}
        </aside>
      </div>
    </div>
  )
}

/* ---------- panels ---------- */
const inputCls = 'h-11 w-full rounded-[12px] border border-outline-variant bg-white px-3 text-sm font-medium text-on-surface box-border'
const areaCls = 'w-full rounded-[12px] border border-outline-variant bg-white px-3 py-2.5 text-sm font-medium text-on-surface box-border leading-normal'
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5 text-xs font-bold text-on-surface-variant">{label}{children}</label>
)

function Palette({ title, items, onAdd }: { title: string; items: [string, string, typeof Box, string][]; onAdd: (k: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="lbl text-[11px]">{title}</span>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([k, label, Icon, c]) => (
          <button key={k} draggable onDragStart={(e) => { e.dataTransfer.setData('application/ph', k); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => onAdd(k)}
            className="flex cursor-grab flex-col items-center gap-1.5 rounded-2xl border border-outline-variant bg-white px-1 py-3 text-xs font-semibold hover:border-primary hover:bg-primary-container">
            <Icon size={22} color={c} aria-hidden />{label}
          </button>
        ))}
      </div>
    </div>
  )
}

type SetDraft = React.Dispatch<React.SetStateAction<Process>>
type Commit = (fn: (d: Process) => Process) => void

const SCENES: { id: SceneKind; label: string }[] = [
  { id: 'auto', label: 'Automatic (from the words)' }, { id: 'home', label: 'Home' }, { id: 'office', label: 'Office' }, { id: 'calendar', label: 'Calendar / booking' },
  { id: 'classroom', label: 'Training / session' }, { id: 'records', label: 'Records / systems' }, { id: 'payment', label: 'Payment' }, { id: 'delivery', label: 'Delivery' }, { id: 'generic', label: 'Simple building' },
]

function StageEditor({ proc, stageId, setDraft, commit, onDeleted }: { proc: Process; stageId: string; setDraft: SetDraft; commit: Commit; onDeleted: () => void }) {
  const idx = proc.stages.findIndex((s) => s.id === stageId)
  const s = proc.stages[idx]
  if (!s) return null
  const set = (patch: Partial<typeof s>) => setDraft((d) => ({ ...d, stages: d.stages.map((x) => x.id === stageId ? { ...x, ...patch } : x) }))
  const move = (dir: number) => commit((d) => { const j = idx + dir; if (j < 0 || j >= d.stages.length) return d; const [x] = d.stages.splice(idx, 1); d.stages.splice(j, 0, x); return d })
  const used = proc.steps.some((x) => x.stageId === stageId)
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl font-extrabold text-white" style={{ background: s.color }}>{idx + 1}</span>
        <h3 className="m-0 flex-1 text-base font-extrabold">Stage (3D island)</h3>
        <Button variant="icon" size="icon" aria-label="Move earlier" onClick={() => move(-1)}><ChevronLeft size={18} /></Button>
        <Button variant="icon" size="icon" aria-label="Move later" onClick={() => move(1)}><ChevronRight size={18} /></Button>
      </div>
      <Field label="Short name (under the island)"><input className={inputCls} value={s.short} onChange={(e) => set({ short: e.target.value })} /></Field>
      <Field label="Title"><input className={inputCls} value={s.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Where it happens"><input className={inputCls} value={s.place} onChange={(e) => set({ place: e.target.value })} placeholder="e.g. the Scope office" /></Field>
      <Field label="What happens, in one or two sentences"><textarea rows={3} className={areaCls} value={s.text} onChange={(e) => set({ text: e.target.value })} /></Field>
      <Field label="Systems (comma separated)"><input className={inputCls} value={s.systems.join(', ')} onChange={(e) => set({ systems: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
      <Field label="Documents you'll need (comma separated)"><input className={inputCls} value={s.docs.join(', ')} onChange={(e) => set({ docs: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
      <Field label="3D look"><select className={inputCls} value={s.scene} onChange={(e) => set({ scene: e.target.value as SceneKind })}>{SCENES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>
      <div className="flex flex-col gap-1.5"><span className="text-xs font-bold text-on-surface-variant">Colour</span>
        <div className="flex flex-wrap gap-2">{STAGE_COLORS.map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => set({ color: c })} className="h-8 w-8 cursor-pointer rounded-full border-0" style={{ background: c, boxShadow: s.color === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : undefined }} />)}</div>
      </div>
      <Button variant="danger" size="sm" className="self-start" disabled={used || proc.stages.length < 2} onClick={() => { commit((d) => ({ ...d, stages: d.stages.filter((x) => x.id !== stageId) })); onDeleted() }}><Trash2 size={15} />Delete stage</Button>
      {used && <p className="m-0 -mt-2 text-xs text-on-surface-variant">Move or delete its steps first.</p>}
    </>
  )
}

function ProcessEditor({ proc, setDraft, commit, admin }: { proc: Process; setDraft: SetDraft; commit: Commit; admin: boolean }) {
  const set = (patch: Partial<Process>) => setDraft((d) => ({ ...d, ...patch }))
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="grid grid-cols-[90px_1fr] gap-2.5">
        <Field label="Code"><input className={inputCls} value={proc.code ?? ''} onChange={(e) => set({ code: e.target.value || undefined })} /></Field>
        <Field label="Area"><input className={inputCls} value={proc.area} onChange={(e) => set({ area: e.target.value })} /></Field>
      </div>
      <Field label="Owner"><input className={inputCls} value={proc.owner} disabled={!admin} onChange={(e) => set({ owner: e.target.value })} /></Field>
      <Field label="One-line summary"><textarea rows={2} className={areaCls} value={proc.summary} onChange={(e) => set({ summary: e.target.value })} /></Field>
      <Field label="In a nutshell (plain words)"><textarea rows={4} className={areaCls} value={proc.nutshell} onChange={(e) => set({ nutshell: e.target.value })} /></Field>
      <Field label="Who it's for"><textarea rows={2} className={areaCls} value={proc.audience ?? ''} onChange={(e) => set({ audience: e.target.value })} /></Field>
      <Field label="It starts when… (one per line — each becomes a flag)"><textarea rows={4} className={areaCls} defaultValue={proc.triggers.join('\n')} onBlur={(e) => set({ triggers: lines(e.target.value) })} /></Field>
      <Field label="It's done when… (one per line)"><textarea rows={3} className={areaCls} defaultValue={proc.outcomes.join('\n')} onBlur={(e) => set({ outcomes: lines(e.target.value) })} /></Field>
      <div className="flex flex-col gap-2"><span className="text-xs font-bold text-on-surface-variant">Roles (one lane each)</span>
        {proc.roles.map((r, k) => {
          const used = proc.steps.some((s) => s.roleId === r.id)
          return (
            <div key={r.id} className="flex items-center gap-2">
              <button aria-label="Change colour" onClick={() => commit((d) => { d.roles[k].color = ROLE_COLORS[(ROLE_COLORS.indexOf(r.color) + 1) % ROLE_COLORS.length]; return d })} className="h-7 w-7 flex-none cursor-pointer rounded-full border-0" style={{ background: r.color }} />
              <input className={inputCls} value={r.name} aria-label="Role name" onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, roles: d.roles.map((x) => x.id === r.id ? { ...x, name: v } : x) })) }} />
              <Button variant="icon" size="icon" aria-label="Remove role" disabled={used || proc.roles.length < 2} onClick={() => commit((d) => ({ ...d, roles: d.roles.filter((x) => x.id !== r.id) }))}><Trash2 size={16} /></Button>
            </div>
          )
        })}
        <Button variant="tonal" size="sm" className="self-start" onClick={() => commit((d) => { d.roles.push({ id: uid('r'), name: 'New role', color: ROLE_COLORS[d.roles.length % ROLE_COLORS.length] }); return d })}><Plus size={15} />Add role</Button>
      </div>
      <label className="flex items-center gap-2.5 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={!proc.needsCompleting} onChange={(e) => set({ needsCompleting: !e.target.checked })} />This process is complete</label>
      <p className="m-0 flex items-center gap-1.5 text-xs text-on-surface-variant"><CircleDot size={12} />Changes save automatically in this browser. Export from Admin to share with everyone.</p>
    </div>
  )
}
