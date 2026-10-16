import { cn } from '@/lib/utils'
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full border border-outline-variant bg-white p-1">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cn('h-10 cursor-pointer rounded-full px-4 text-sm font-bold', value === o.id ? 'bg-on-surface text-white' : 'text-on-surface-variant hover:bg-surface-low')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
