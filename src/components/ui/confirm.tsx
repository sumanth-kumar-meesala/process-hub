import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** A button that asks "are you sure?" in place, without a browser pop-up. */
export function ConfirmButton({ label, question, confirmLabel, onConfirm, icon, disabled, variant = 'danger', size = 'sm', iconOnly = false }: {
  label: string; question: string; confirmLabel: string; onConfirm: () => void; icon: React.ReactNode; disabled?: boolean
  variant?: 'danger' | 'outlined'; size?: 'sm' | 'icon'; iconOnly?: boolean
}) {
  const [ask, setAsk] = useState(false)
  if (!ask) return (
    <Button variant={iconOnly ? 'icon' : variant} size={iconOnly ? 'icon' : size} aria-label={label} title={label} disabled={disabled}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAsk(true) }}>{icon}{!iconOnly && label}</Button>
  )
  return (
    <span role="alertdialog" aria-label={question} className="inline-flex items-center gap-1.5 rounded-full bg-error-container py-1 pl-3 pr-1 text-[13px] font-semibold text-error" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      {question}
      <button autoFocus onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAsk(false); onConfirm() }} className="h-8 cursor-pointer rounded-full border-0 bg-error px-3 text-[13px] font-bold text-white">{confirmLabel}</button>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAsk(false) }} className="h-8 cursor-pointer rounded-full border-0 bg-white px-3 text-[13px] font-bold text-on-surface">Cancel</button>
    </span>
  )
}

