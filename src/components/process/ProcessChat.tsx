import { useEffect, useState } from 'react'
import { MessageCircleQuestion, X } from 'lucide-react'
import { AskPanel } from '@/components/process/AskPanel'
import type { Process } from '@/lib/types'

/** The AI assistant, bottom right on the 3D map and the Timeline: chat with the process in your own words. */
export function ProcessChat({ proc, onShowStage }: { proc: Process; onShowStage?: (k: number) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden max-sm:bottom-3 max-sm:right-3">
      {open && (
        <div className="pointer-events-auto w-[380px] max-w-[calc(100vw-24px)]">
          <AskPanel proc={proc} docked onClose={() => setOpen(false)} onShowStage={(k) => { onShowStage?.(k); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </div>
      )}
      {/* round, in the corner, so it never covers the page's own buttons */}
      <button onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-label={open ? 'Close the assistant' : 'Ask about this process'} title={open ? 'Close' : 'Ask about this process'}
        className="group pointer-events-auto relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-0 bg-primary text-white shadow-[0_8px_24px_rgba(29,78,216,.35)] hover:bg-[#1a44c0]">
        {open ? <X size={22} /> : <MessageCircleQuestion size={24} />}
        {!open && <span className="pointer-events-none absolute right-[calc(100%+10px)] whitespace-nowrap rounded-full bg-on-surface px-3 py-1.5 text-[13px] font-bold text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Ask about this process</span>}
      </button>
    </div>
  )
}
