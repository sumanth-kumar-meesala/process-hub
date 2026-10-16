import { Fragment, useMemo } from 'react'
import { useData } from '@/store/store'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Text with glossary words underlined; hover or tap (focus) a word to see what it means. */
export function Terms({ text, className }: { text: string; className?: string }) {
  const glossary = useData((s) => s.glossary)
  const parts = useMemo(() => {
    if (!glossary.length || !text) return [text]
    const sorted = [...glossary].sort((a, b) => b.term.length - a.term.length)
    const re = new RegExp(`(?<![A-Za-z0-9])(${sorted.map((t) => esc(t.term)).join('|')})(?![A-Za-z0-9])`, 'gi')
    return text.split(re)
  }, [text, glossary])
  const meaning = (w: string) => glossary.find((t) => t.term.toLowerCase() === w.toLowerCase())?.meaning
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = i % 2 === 1 ? meaning(p) : undefined
        return m
          ? <span key={i} className="term" tabIndex={0} aria-label={`${p}: ${m}`}>{p}<span role="tooltip" className="term-tip">{m}</span></span>
          : <Fragment key={i}>{p}</Fragment>
      })}
    </span>
  )
}
