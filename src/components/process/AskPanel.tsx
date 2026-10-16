import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MessageCircleQuestion, Send, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { askAbout, type ChatMsg } from '@/ai/groq'
import { useData, useSession } from '@/store/store'
import type { Process } from '@/lib/types'

interface Msg extends ChatMsg { stage?: number | null }

/** Anyone can ask questions about the process they are looking at. */
export function AskPanel({ proc, onClose, onShowStage }: { proc: Process; onClose: () => void; onShowStage: (k: number) => void }) {
  const { groqKey, model, persona } = useSession()
  const library = useData((s) => s.library)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const starters = [
    'What do I need before I start?',
    proc.roles[0] ? `What does the ${proc.roles[0].name} do?` : 'Who is involved?',
    'What happens if a check fails?',
  ]
  const send = async (q: string) => {
    if (!q.trim() || busy) return
    setErr(''); setText('')
    const history = msgs.map(({ role, content }) => ({ role, content }))
    setMsgs((m) => [...m, { role: 'user', content: q }]); setBusy(true)
    try {
      const r = await askAbout({ key: groqKey, model, process: proc, library, history, question: q })
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer, stage: r.stage }])
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false); setTimeout(() => end.current?.scrollIntoView({ block: 'end' }), 30) }
  }
  return (
    <aside aria-label="Ask about this process" className="absolute right-2 top-0 z-[45] flex max-h-full max-sm:static max-sm:w-full max-sm:max-w-none max-sm:max-h-none w-[360px] max-w-[calc(100%-16px)] flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-white shadow-[0_2px_6px_rgba(15,23,42,.06),0_24px_60px_rgba(30,58,138,.22)]">
      <div className="flex items-center gap-2.5 bg-primary-container px-5 py-3.5 text-on-primary-container">
        <MessageCircleQuestion size={20} aria-hidden /><b className="flex-1 text-[15px]">Ask about this process</b>
        <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-white/70"><X size={15} /></button>
      </div>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
        {!groqKey ? (
          <p className="m-0 text-sm text-on-surface-variant">The assistant isn't switched on yet. {persona === 'admin' ? <Link to="/admin">Add a Groq key in Admin</Link> : 'Ask your Global Admin to add a Groq key in Admin.'}</p>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col gap-2"><span className="text-sm text-on-surface-variant">Ask anything in your own words. Answers come only from this process.</span>
            {starters.map((s) => <button key={s} onClick={() => send(s)} className="cursor-pointer rounded-xl border border-outline-variant bg-white px-3 py-2 text-left text-sm font-semibold hover:bg-surface-low">{s}</button>)}
          </div>
        ) : msgs.map((m, k) => (
          <div key={k} className={m.role === 'user' ? 'self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-white' : 'flex flex-col gap-2 self-start rounded-2xl rounded-bl-md bg-surface-low px-3.5 py-2.5 text-sm leading-relaxed'}>
            <span className="whitespace-pre-wrap">{m.content}</span>
            {m.stage && <button onClick={() => onShowStage(m.stage! - 1)} className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-full border-0 px-3 py-1 text-xs font-bold text-white" style={{ background: proc.stages[m.stage - 1]?.color }}>Show me stage {m.stage}<ArrowRight size={13} /></button>}
          </div>
        ))}
        {busy && <span className="flex items-center gap-2 text-sm text-on-surface-variant"><Loader2 size={15} className="animate-spin" />Thinking…</span>}
        {err && <span className="rounded-xl bg-error-container px-3 py-2 text-sm text-error">{err}</span>}
        <div ref={end} />
      </div>
      {groqKey && (
        <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="flex gap-2 border-t border-outline-variant p-3">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question…" aria-label="Your question" className="h-11 flex-1 rounded-full border border-outline-variant px-4 text-sm outline-none focus:border-primary" />
          <Button type="submit" size="iconLg" aria-label="Send" disabled={busy || !text.trim()}><Send size={16} /></Button>
        </form>
      )}
    </aside>
  )
}
