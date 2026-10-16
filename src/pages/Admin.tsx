import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useData, useSession } from '@/store/store'
import { PERSONAS, type Persona, type Process } from '@/lib/types'
import { displayName } from '@/lib/derive'
import { INPUT_BUDGET, KEEP_MESSAGES, testGroq } from '@/ai/groq'
import { cn } from '@/lib/utils'

const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
type Tab = 'ai' | 'people' | 'processes'

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
          {([['ai', 'AI assistant'], ['people', 'People & access'], ['processes', 'Processes']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn('h-12 cursor-pointer rounded-full border-0 px-4 text-left text-sm font-bold', tab === id ? 'bg-primary-container text-on-primary-container' : 'bg-transparent text-on-surface-variant hover:bg-surface-mid')}>{label}</button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          {tab === 'ai' && <AiSettings />}
          {tab === 'people' && <People />}
          {tab === 'processes' && <Processes />}
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
            {!p.seeded && <Button variant="icon" size="icon" aria-label={`Delete ${p.title}`} onClick={() => remove(p.id)}><Trash2 size={16} /></Button>}
          </div>
        ))}
      </div>
      <Button variant="danger" className="self-start" onClick={() => { resetToStarter(); setNote('Back to the five starter processes.') }}><RotateCcw size={16} />Reset to starter processes</Button>
    </Card>
  )
}
