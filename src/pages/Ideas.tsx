import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, Loader2, Plus, Sparkles, Star, ThumbsUp, Trash2, X, Search } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useData, useSession } from '@/store/store'
import { useAiKey } from '@/ai/config'
import { findIdeas } from '@/ai/ideas'
import { ideaScore, scanIdeas, type Idea } from '@/lib/ideas'
import { uid } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'shortlist' | 'ai' | 'scan' | 'mine' | 'dropped'
const FILTERS: [Filter, string][] = [['all', 'All'], ['shortlist', 'Shortlist'], ['ai', 'Found by AI'], ['scan', 'Found in the processes'], ['mine', 'Mine'], ['dropped', 'Dropped']]

/** Ideas that solve real problems in the processes — and that someone would pay for. */
export default function Ideas() {
  const { processes, ideas, addIdeas, updateIdea, removeIdea } = useData()
  const { model } = useSession()
  const { key } = useAiKey()
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const shown = useMemo(() => ideas
    .filter((i) => filter === 'dropped' ? i.status === 'dropped' : i.status !== 'dropped')
    .filter((i) => filter === 'all' || filter === 'dropped' || (filter === 'shortlist' ? i.status === 'shortlist' : i.origin === filter))
    .sort((a, b) => Number(b.status === 'shortlist') - Number(a.status === 'shortlist') || b.votes - a.votes || ideaScore(b) - ideaScore(a)), [ideas, filter])

  const find = async () => {
    setBusy(true); setNote('')
    try {
      // without an AI key, look for patterns in the processes instead
      const found = key ? await findIdeas({ key, model, processes, existing: ideas }) : scanIdeas(processes)
      const fresh = found.filter((i) => !ideas.some((x) => x.title.toLowerCase() === i.title.toLowerCase()))
      addIdeas(fresh)
      setNote(fresh.length ? `${fresh.length} new idea${fresh.length > 1 ? 's' : ''} found${key ? '' : ' in the processes (add an AI key in Admin for more creative ones)'}.` : 'No new ideas this time — try again, or add your own.')
      setFilter('all')
    } catch (e) {
      // AI failed (limit, network): still give something useful
      const fallback = scanIdeas(processes).filter((i) => !ideas.some((x) => x.title.toLowerCase() === i.title.toLowerCase()))
      addIdeas(fallback)
      setNote(`The AI couldn't answer (${(e as Error).message}). ${fallback.length ? `Found ${fallback.length} idea${fallback.length > 1 ? 's' : ''} in the processes instead.` : ''}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 pb-20 pt-4 sm:px-8">
        <section className="flex flex-wrap items-end gap-4 rounded-[32px] bg-[linear-gradient(135deg,#FFF7E6,#EEF2FF)] p-6 sm:p-8">
          <div className="flex min-w-[min(460px,100%)] flex-1 flex-col gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F59E0B]"><Lightbulb size={26} color="#fff" aria-hidden /></span>
            <h1 className="m-0 text-[clamp(26px,3.4vw,38px)] font-extrabold leading-tight tracking-[-0.02em]">Ideas worth paying for</h1>
            <p className="m-0 max-w-[640px] text-[15px] leading-relaxed text-on-surface-variant">
              New ideas that fix real problems in your processes — work that bounces back, people chasing each other, evidence gathered by hand — and that someone would pay for. Each one shows where the problem is, who would pay, and how new it is.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={find} disabled={busy}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{busy ? 'Looking…' : 'Find new ideas'}</Button>
            <Button size="lg" variant="outlined" onClick={() => setAdding(true)}><Plus size={17} />Add my idea</Button>
          </div>
          {note && <p className="m-0 w-full text-sm font-semibold text-on-surface">{note}</p>}
        </section>

        {adding && <AddIdea processes={processes.map((p) => ({ id: p.id, title: p.title }))} onCancel={() => setAdding(false)} onAdd={(i) => { addIdeas([i]); setAdding(false); setFilter('mine') }} />}

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(([id, label]) => {
            const count = ideas.filter((i) => id === 'dropped' ? i.status === 'dropped' : i.status !== 'dropped' && (id === 'all' || (id === 'shortlist' ? i.status === 'shortlist' : i.origin === id))).length
            return (
              <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
                className={cn('h-9 cursor-pointer rounded-full border px-4 text-sm font-semibold', filter === id ? 'border-on-surface bg-on-surface text-white' : 'border-outline-variant bg-white text-on-surface-variant hover:bg-surface-low')}>
                {label}<span className="ml-1.5 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {shown.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <Search size={28} className="text-on-surface-variant" />
            <b className="text-lg">{ideas.length ? 'Nothing here yet' : 'No ideas yet'}</b>
            <p className="m-0 max-w-[460px] text-sm text-on-surface-variant">Press <b>Find new ideas</b> and Process Hub will look through every process for problems worth solving. You can also add your own.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
            {shown.map((i) => <IdeaCard key={i.id} idea={i} processes={processes.map((p) => ({ id: p.id, title: p.title }))}
              onShortlist={() => updateIdea(i.id, { status: i.status === 'shortlist' ? 'new' : 'shortlist' })}
              onVote={() => updateIdea(i.id, { votes: i.votes + 1 })}
              onDrop={() => i.origin === 'mine' ? removeIdea(i.id) : updateIdea(i.id, { status: i.status === 'dropped' ? 'new' : 'dropped' })} />)}
          </div>
        )}
      </main>
    </div>
  )
}

const ORIGIN: Record<Idea['origin'], { label: string; cls: string }> = {
  ai: { label: 'Found by AI', cls: 'bg-primary-container text-on-primary-container' },
  scan: { label: 'Found in the processes', cls: 'bg-secondary-container text-on-secondary-container' },
  mine: { label: 'My idea', cls: 'bg-[#FFE9D9] text-[#9A3412]' },
}

function Meter({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1" title={`${label}: ${n} out of 5`}>
      <span className="text-[11px] font-bold text-on-surface-variant">{label}</span>
      <span className="flex gap-0.5" aria-label={`${label} ${n} of 5`}>
        {[1, 2, 3, 4, 5].map((k) => <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k <= n ? color : '#E2E8F0' }} />)}
      </span>
    </div>
  )
}

function IdeaCard({ idea: i, processes, onShortlist, onVote, onDrop }: { idea: Idea; processes: { id: string; title: string }[]; onShortlist: () => void; onVote: () => void; onDrop: () => void }) {
  const star = i.status === 'shortlist'
  return (
    <article className={cn('flex flex-col gap-3.5 rounded-[24px] border-2 bg-white p-5 transition-shadow hover:shadow-md', star ? 'border-[#F59E0B]' : 'border-transparent', i.status === 'dropped' && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={cn('self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold', ORIGIN[i.origin].cls)}>{ORIGIN[i.origin].label}</span>
          <h2 className="m-0 text-lg font-extrabold leading-snug">{i.title}</h2>
        </div>
        <span className="flex flex-col items-center rounded-2xl bg-surface-low px-3 py-1.5" title="Pain + new + would pay, out of 15">
          <b className="text-xl leading-none">{ideaScore(i)}</b><span className="text-[10px] font-bold text-on-surface-variant">/ 15</span>
        </span>
      </div>
      <div className="flex gap-3">
        <Meter label="Pain today" n={i.scores.pain} color="#DC2626" />
        <Meter label="How new" n={i.scores.novelty} color="#7C3AED" />
        <Meter label="Would pay" n={i.scores.pay} color="#16A34A" />
      </div>
      <dl className="m-0 flex flex-col gap-2.5 text-sm leading-relaxed">
        <Row label="The problem">{i.problem}</Row>
        {i.solution && <Row label="The idea">{i.solution}</Row>}
        {(i.whoPays || i.whyPay) && <Row label="Who pays, and why">{i.whoPays}{i.whoPays && i.whyPay ? ' — ' : ''}{i.whyPay}</Row>}
        {i.price && <Row label="How it could charge">{i.price}</Row>}
        {i.novelty && <Row label="What's new">{i.novelty}</Row>}
      </dl>
      {i.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {i.sources.slice(0, 4).map((s, k) => (
            <Link key={k} to={`/process/${s.processId}`} className="rounded-lg bg-surface-low px-2 py-1 text-xs font-semibold text-on-surface no-underline hover:bg-surface-mid">
              {s.label || processes.find((p) => p.id === s.processId)?.title}
            </Link>
          ))}
          {i.sources.length > 4 && <span className="px-1 py-1 text-xs text-on-surface-variant">+{i.sources.length - 4} more</span>}
        </div>
      )}
      <div className="mt-auto flex items-center gap-1.5 border-t border-outline-variant pt-3">
        <Button size="sm" variant={star ? 'filled' : 'outlined'} className={star ? 'bg-[#F59E0B] hover:bg-[#D97706]' : ''} onClick={onShortlist} aria-pressed={star}>
          <Star size={14} fill={star ? '#fff' : 'none'} />{star ? 'Shortlisted' : 'Shortlist'}
        </Button>
        <Button size="sm" variant="tonal" onClick={onVote} aria-label="Vote for this idea"><ThumbsUp size={14} />{i.votes || ''}</Button>
        <div className="flex-1" />
        <Button size="sm" variant="text" onClick={onDrop}>{i.origin === 'mine' ? <><Trash2 size={14} />Delete</> : i.status === 'dropped' ? 'Bring back' : <><X size={14} />Drop</>}</Button>
      </div>
    </article>
  )
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><dt className="text-[11px] font-extrabold uppercase tracking-[.05em] text-on-surface-variant">{label}</dt><dd className="m-0">{children}</dd></div>
)

const inputCls = 'h-11 w-full rounded-xl border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary'

function AddIdea({ processes, onAdd, onCancel }: { processes: { id: string; title: string }[]; onAdd: (i: Idea) => void; onCancel: () => void }) {
  const [f, setF] = useState({ title: '', problem: '', solution: '', whoPays: '', price: '', processId: '', pain: 3, novelty: 3, pay: 3 })
  const ok = f.title.trim() && f.problem.trim()
  const submit = () => {
    if (!ok) return
    onAdd({
      id: uid('idea'), title: f.title.trim(), problem: f.problem.trim(), solution: f.solution.trim(), whoPays: f.whoPays.trim(), whyPay: '', price: f.price.trim(), novelty: '',
      sources: f.processId ? [{ processId: f.processId, label: processes.find((p) => p.id === f.processId)?.title ?? '' }] : [],
      scores: { pain: f.pain, novelty: f.novelty, pay: f.pay }, origin: 'mine', status: 'new', votes: 0, createdAt: new Date().toISOString(),
    })
  }
  const Score = ({ k, label }: { k: 'pain' | 'novelty' | 'pay'; label: string }) => (
    <label className="flex flex-1 flex-col gap-1 text-xs font-bold text-on-surface-variant">{label}
      <select className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
    </label>
  )
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex items-center"><h2 className="m-0 flex-1 text-lg font-extrabold">Add my idea</h2><Button variant="icon" size="icon" aria-label="Cancel" onClick={onCancel}><X size={18} /></Button></div>
      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        <input className={inputCls} placeholder="Idea name (a few words)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Idea name" />
        <select className={inputCls} value={f.processId} onChange={(e) => setF({ ...f, processId: e.target.value })} aria-label="Which process">
          <option value="">Which process is it about? (optional)</option>{processes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <input className={inputCls} placeholder="The problem it solves" value={f.problem} onChange={(e) => setF({ ...f, problem: e.target.value })} aria-label="The problem" />
        <input className={inputCls} placeholder="What it does" value={f.solution} onChange={(e) => setF({ ...f, solution: e.target.value })} aria-label="What it does" />
        <input className={inputCls} placeholder="Who would pay for it" value={f.whoPays} onChange={(e) => setF({ ...f, whoPays: e.target.value })} aria-label="Who would pay" />
        <input className={inputCls} placeholder="How it could charge (optional)" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} aria-label="Price" />
        <div className="flex gap-2"><Score k="pain" label="Pain today" /><Score k="novelty" label="How new" /><Score k="pay" label="Would pay" /></div>
        <div className="flex items-end gap-2"><Button type="submit" disabled={!ok}><Plus size={16} />Add idea</Button><Button type="button" variant="text" onClick={onCancel}>Cancel</Button></div>
      </form>
    </Card>
  )
}
