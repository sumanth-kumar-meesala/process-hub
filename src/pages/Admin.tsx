import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { ConfirmButton } from '@/components/ui/confirm'
import { Card } from '@/components/ui/card'
import { useData, useSession } from '@/store/store'
import { PERSONAS, type Persona, type Process, type ResourceCategory } from '@/lib/types'
import { CATEGORIES } from '@/lib/resources'
import { displayName } from '@/lib/derive'
import { INPUT_BUDGET, KEEP_MESSAGES, testGroq } from '@/ai/groq'
import { cn } from '@/lib/utils'

const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
type Tab = 'ai' | 'people' | 'processes' | 'library' | 'glossary'

export default function Admin() {
  const { persona } = useSession()
  const [tab, setTab] = useState<Tab>('ai')
  if (persona !== 'admin') return (
    <div><AppHeader /><div className="mx-auto max-w-[640px] p-10"><Card className="p-8">
      <h1 className="m-0 mb-2 text-2xl font-extrabold">Admin is for the Global Admin</h1>
      <p className="m-0 text-on-surface-variant">For this prototype, switch “I am” at the top to Global Admin.</p>
    </Card></div></div>
  )
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-6 px-4 pb-16 pt-4 sm:px-8">
        <nav aria-label="Admin" className="flex w-full max-w-[260px] flex-col gap-1 sm:w-auto sm:flex-[1_1_220px]">
          {([['ai', 'AI assistant'], ['people', 'People & access'], ['processes', 'Processes'], ['library', 'Resource library'], ['glossary', 'Plain-language words']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn('h-12 cursor-pointer rounded-full border-0 px-4 text-left text-sm font-bold', tab === id ? 'bg-primary-container text-on-primary-container' : 'bg-transparent text-on-surface-variant hover:bg-surface-mid')}>{label}</button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          {tab === 'ai' && <AiSettings />}
          {tab === 'people' && <People />}
          {tab === 'processes' && <Processes />}
          {tab === 'library' && <Library />}
          {tab === 'glossary' && <Glossary />}
        </div>
      </main>
    </div>
  )
}

const inputCls = 'h-12 w-full rounded-[14px] border border-outline-variant bg-white px-3.5 text-[15px] font-medium box-border'

function AiSettings() {
  const { groqKey, model, setGroq } = useSession()
  const [key, setKey] = useState(groqKey)
  const [m, setM] = useState(model)
  const [state, setState] = useState<{ kind: 'idle' | 'ok' | 'err' | 'busy'; text?: string }>({ kind: 'idle' })
  const save = () => { setGroq(key.trim(), m.trim()); setState({ kind: 'ok', text: 'Saved in this browser.' }) }
  const test = async () => {
    setState({ kind: 'busy', text: 'Testing…' })
    try { await testGroq(key.trim(), m.trim()); setState({ kind: 'ok', text: 'Connected — Groq answered.' }) }
    catch (e) { setState({ kind: 'err', text: `Couldn't connect: ${(e as Error).message}` }) }
  }
  return (
    <>
      <Card className="flex flex-col gap-4 rounded-[28px] p-7">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary"><Sparkles size={24} color="#fff" /></span>
          <div className="flex-1"><h1 className="m-0 text-2xl font-extrabold">AI assistant</h1><div className="text-sm text-on-surface-variant">Used by the Builder to create and change processes</div></div>
          <span className={cn('inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[13px] font-bold', groqKey ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-mid')}>
            <span className={cn('h-2 w-2 rounded-full', groqKey ? 'bg-secondary' : 'bg-outline')} />{groqKey ? 'Key saved' : 'No key yet'}
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-on-surface-variant">Groq API key
            <input type="password" className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_…" autoComplete="off" aria-describedby="keynote" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-on-surface-variant">Model
            <input className={inputCls} list="models" value={m} onChange={(e) => setM(e.target.value)} />
            <datalist id="models">{MODELS.map((x) => <option key={x} value={x} />)}</datalist>
          </label>
        </div>
        <p id="keynote" className="m-0 text-[13px] leading-normal text-on-surface-variant">The key stays in this browser only (it is never put in the website or the GitHub repo). Anyone using this browser can use it, so only save it on your own device. Check your current model names and limits in your Groq console.</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={save}>Save</Button>
          <Button variant="tonal" onClick={test} disabled={!key || state.kind === 'busy'}>Test connection</Button>
          <Button variant="danger" onClick={() => { setKey(''); setGroq('', m); setState({ kind: 'ok', text: 'Key removed.' }) }}>Remove key</Button>
          {state.text && <span className={cn('text-sm font-semibold', state.kind === 'err' ? 'text-error' : 'text-secondary')}>{state.text}</span>}
        </div>
      </Card>
      <Card className="flex flex-col gap-4 rounded-[28px] p-7">
        <h2 className="m-0 text-lg font-extrabold">How we stay within Groq's limits</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <div className="rounded-[18px] bg-surface-low p-4"><div className="text-[26px] font-extrabold">{INPUT_BUDGET / 1000}k</div><div className="text-[13px] text-on-surface-variant">Max tokens sent per request — under the free tier's per-minute limit</div></div>
          <div className="rounded-[18px] bg-surface-low p-4"><div className="text-[26px] font-extrabold">Last {KEEP_MESSAGES}</div><div className="text-[13px] text-on-surface-variant">Chat messages sent in full; older ones are folded into a short summary</div></div>
          <div className="rounded-[18px] bg-surface-low p-4"><div className="text-[26px] font-extrabold">Compact</div><div className="text-[13px] text-on-surface-variant">Only a short text outline of the process is sent, and the AI replies with small changes</div></div>
          <div className="rounded-[18px] bg-surface-low p-4"><div className="text-[26px] font-extrabold">Auto-retry</div><div className="text-[13px] text-on-surface-variant">If Groq says “too many requests”, we wait the time it asks and try once more</div></div>
        </div>
      </Card>
    </>
  )
}

function People() {
  const { people, setPersonPersona, addPerson } = useData()
  const [name, setName] = useState('')
  return (
    <Card className="flex flex-col gap-4 rounded-[28px] p-7">
      <h1 className="m-0 text-2xl font-extrabold">People & access</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
        {PERSONAS.map((p) => (
          <div key={p.id} className={cn('rounded-2xl p-3.5 text-[13px]', p.id === 'admin' ? 'bg-on-surface text-white' : p.id === 'owner' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-low')}>
            <b className="mb-1 block text-sm">{p.label}</b>{p.blurb}
          </div>
        ))}
      </div>
      <div>
        {people.map((u) => (
          <div key={u.id} className="flex items-center gap-3.5 border-b border-surface-mid px-1 py-3 last:border-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-[13px] font-extrabold text-on-primary-container">{u.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
            <div className="flex-1"><b>{u.name}</b>{u.note && <div className="text-[13px] text-on-surface-variant">{u.note}</div>}</div>
            <select aria-label={`Persona for ${u.name}`} value={u.persona} onChange={(e) => setPersonPersona(u.id, e.target.value as Persona)} className="h-9 rounded-full border border-outline-variant bg-white px-2.5 text-[13px] font-semibold">
              {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { addPerson(name.trim()); setName('') } }}>
        <label htmlFor="newp" className="sr-only">Name</label>
        <input id="newp" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a person by name" />
        <Button type="submit"><Plus size={16} />Add</Button>
      </form>
      <p className="m-0 text-xs text-on-surface-variant">This prototype has no sign-in yet: the “I am” switch at the top decides what you can do. With real sign-in, these assignments would control access.</p>
    </Card>
  )
}

function Processes() {
  const { processes, importMany, resetToStarter, remove } = useData()
  const file = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const exportAll = () => {
    const blob = new Blob([JSON.stringify(processes, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'process-hub-processes.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  const onFile = async (f?: File) => {
    if (!f) return
    try { const data = JSON.parse(await f.text()); const n = importMany(Array.isArray(data) ? data : [data] as Process[]); setNote(`Imported ${n} process${n === 1 ? '' : 'es'}.`) }
    catch { setNote("That file couldn't be read. It should be a Process Hub export (.json).") }
  }
  return (
    <Card className="flex flex-col gap-4 rounded-[28px] p-7">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="m-0 flex-1 text-2xl font-extrabold">Processes</h1>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="tonal" onClick={() => file.current?.click()}><Upload size={16} />Import file</Button>
        <Button variant="tonal" onClick={exportAll}><Download size={16} />Export all</Button>
        <Button asChild><Link to="/builder" className="no-underline"><Plus size={16} />New process</Link></Button>
      </div>
      <p className="m-0 text-[13px] text-on-surface-variant">The five starter processes come with the app. Changes and new processes are saved in this browser — export them and add the file to the repo (src/data) to share them with everyone.</p>
      {note && <p className="m-0 text-sm font-semibold text-secondary">{note}</p>}
      <div>
        {processes.map((p) => (
          <div key={p.id} className="flex items-center gap-3.5 border-b border-surface-mid px-1 py-3 last:border-0">
            <div className="flex-1"><Link to={`/process/${p.id}`} className="font-bold text-on-surface no-underline">{displayName(p)}</Link><div className="text-[13px] text-on-surface-variant">{p.owner} · {p.area}{p.needsCompleting ? ' · being completed' : ''}</div></div>
            <span className={cn('text-xs font-bold', p.status === 'published' ? 'text-secondary' : 'text-on-surface-variant')}>{p.status === 'published' ? 'Published' : 'Draft'}</span>
            <Button variant="text" size="sm" asChild><Link to={`/builder/${p.id}`}>Edit</Link></Button>
            <ConfirmButton iconOnly label={`Delete ${p.title}`} question="Delete?" confirmLabel="Delete" icon={<Trash2 size={16} />} onConfirm={() => remove(p.id)} />
          </div>
        ))}
      </div>
      <div className="self-start"><ConfirmButton label="Reset to starter processes" question="Replace everything with the five starter processes?" confirmLabel="Reset" icon={<RotateCcw size={16} />} onConfirm={() => { resetToStarter(); setNote('Back to the five starter processes.') }} /></div>
    </Card>
  )
}

function Glossary() {
  const { glossary, setGlossary } = useData()
  const [nt, setNt] = useState({ term: '', meaning: '' })
  const add = () => {
    if (!nt.term.trim() || !nt.meaning.trim()) return
    setGlossary([...glossary.filter((g) => g.term.toLowerCase() !== nt.term.trim().toLowerCase()), { term: nt.term.trim(), meaning: nt.meaning.trim() }])
    setNt({ term: '', meaning: '' })
  }
  return (
    <Card className="flex flex-col gap-4 rounded-[28px] p-7">
      <h1 className="m-0 text-2xl font-extrabold">Plain-language words</h1>
      <p className="m-0 text-[13px] text-on-surface-variant">Wherever one of these words appears in a process, it is underlined with dots. Hover or tap it to see what it means in everyday words.</p>
      <form onSubmit={(e) => { e.preventDefault(); add() }} className="grid grid-cols-[minmax(140px,200px)_1fr_auto] gap-2 rounded-[20px] bg-surface-low p-3 max-sm:grid-cols-1">
        <input className={inputCls} placeholder="Word or acronym" value={nt.term} onChange={(e) => setNt({ ...nt, term: e.target.value })} aria-label="Word" />
        <input className={inputCls} placeholder="What it means, in plain words" value={nt.meaning} onChange={(e) => setNt({ ...nt, meaning: e.target.value })} aria-label="Meaning" />
        <Button type="submit" disabled={!nt.term.trim() || !nt.meaning.trim()}><Plus size={16} />Add</Button>
      </form>
      <div className="flex flex-col">
        {[...glossary].sort((a, b) => a.term.localeCompare(b.term)).map((g) => (
          <div key={g.term} className="flex items-center gap-3 border-b border-outline-variant py-2 last:border-0">
            <b className="w-[140px] flex-none text-sm">{g.term}</b>
            <input className={cn(inputCls, 'flex-1')} defaultValue={g.meaning} aria-label={`Meaning of ${g.term}`}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.meaning) setGlossary(glossary.map((x) => x.term === g.term ? { ...x, meaning: v } : x)) }} />
            <Button variant="danger" size="icon" aria-label={`Remove ${g.term}`} onClick={() => setGlossary(glossary.filter((x) => x.term !== g.term))}><Trash2 size={16} /></Button>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Library() {
  const { library, processes, addLibraryItems, updateLibraryItem, removeLibraryItem } = useData()
  const [q, setQ] = useState('')
  const [nt, setNt] = useState({ title: '', category: 'form' as ResourceCategory, url: '', tags: '' })
  const uses = (id: string) => processes.reduce((a, p) => a + p.steps.filter((s) => s.resourceIds?.includes(id)).length + ((p.linkedIds ?? []).includes(id) ? 1 : 0), 0)
  const shown = library.filter((it) => `${it.title} ${(it.tags ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  const add = () => {
    if (!nt.title.trim()) return
    addLibraryItems([{ id: `lib-${Date.now().toString(36)}`, title: nt.title.trim(), category: nt.category, url: nt.url.trim() || undefined, tags: nt.tags.split(',').map((x) => x.trim()).filter(Boolean) }])
    setNt({ title: '', category: nt.category, url: '', tags: '' })
  }
  return (
    <Card className="flex flex-col gap-4 rounded-[28px] p-7">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 flex-1 text-2xl font-extrabold">Resource library</h1>
        <label htmlFor="libq" className="sr-only">Search the library</label>
        <input id="libq" className={cn(inputCls, 'max-w-[260px]')} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="m-0 text-[13px] text-on-surface-variant">Forms, client documents, guides, policies and related processes shared by every process. When a process is built, each step is linked to the items it needs automatically. “Tags” are extra words that help that matching. Items added by the AI or a builder are marked <b>New</b> until you review them.</p>
      <form onSubmit={(e) => { e.preventDefault(); add() }} className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 rounded-[20px] bg-surface-low p-3">
        <input className={inputCls} placeholder="New item name" value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} aria-label="New item name" />
        <select className={inputCls} value={nt.category} onChange={(e) => setNt({ ...nt, category: e.target.value as ResourceCategory })} aria-label="Type">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.one}</option>)}</select>
        <input className={inputCls} placeholder="Link (optional)" value={nt.url} onChange={(e) => setNt({ ...nt, url: e.target.value })} aria-label="Link" />
        <input className={inputCls} placeholder="Tags, comma separated" value={nt.tags} onChange={(e) => setNt({ ...nt, tags: e.target.value })} aria-label="Tags" />
        <Button type="submit" disabled={!nt.title.trim()}><Plus size={16} />Add to library</Button>
      </form>
      {CATEGORIES.map((c) => {
        const items = shown.filter((it) => it.category === c.id)
        if (!items.length) return null
        return (
          <div key={c.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 pb-1"><span className="h-3 w-3 rounded-full" style={{ background: c.color }} /><b>{c.title}</b><span className="text-[13px] text-on-surface-variant">{items.length}</span></div>
            {items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center gap-2 border-b border-surface-mid py-2 last:border-0">
                <input aria-label="Name" className="h-10 min-w-[200px] flex-[2_1_220px] rounded-xl border border-outline-variant bg-white px-3 text-sm font-semibold" defaultValue={it.title} onBlur={(e) => e.target.value.trim() && e.target.value !== it.title && updateLibraryItem(it.id, { title: e.target.value.trim() })} />
                <input aria-label="Link" className="h-10 min-w-[160px] flex-[1_1_180px] rounded-xl border border-outline-variant bg-white px-3 text-sm" placeholder="Link" defaultValue={it.url ?? ''} onBlur={(e) => updateLibraryItem(it.id, { url: e.target.value.trim() || undefined })} />
                <input aria-label="Tags" className="h-10 min-w-[160px] flex-[1_1_180px] rounded-xl border border-outline-variant bg-white px-3 text-sm" placeholder="Tags" defaultValue={(it.tags ?? []).join(', ')} onBlur={(e) => updateLibraryItem(it.id, { tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                <span className="w-[70px] text-xs text-on-surface-variant">{uses(it.id)} use{uses(it.id) === 1 ? '' : 's'}</span>
                {it.isNew && <Button variant="tonal" size="sm" onClick={() => updateLibraryItem(it.id, { isNew: false })}>New · mark reviewed</Button>}
                <ConfirmButton iconOnly label={`Delete ${it.title}`} question={uses(it.id) ? 'Delete and unlink?' : 'Delete?'} confirmLabel="Delete" icon={<Trash2 size={16} />} onConfirm={() => removeLibraryItem(it.id)} />
              </div>
            ))}
          </div>
        )
      })}
    </Card>
  )
}
