import { NavLink } from 'react-router-dom'
import { Box, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The switch at the top of a process: the 3D map or the Timeline. Same place and look on both pages. */
export function ViewSwitch({ procId, current }: { procId: string; current: '3d' | 'timeline' }) {
  const items = [
    { id: '3d', label: '3D map', to: `/process/${procId}`, icon: Box },
    { id: 'timeline', label: 'Timeline', to: `/process/${procId}/timeline`, icon: ListTree },
  ] as const
  return (
    <nav aria-label="How to view this process" className="flex gap-1 rounded-full border border-outline-variant bg-white p-1 print:hidden">
      {items.map((x) => (
        <NavLink key={x.id} to={x.to} aria-current={x.id === current ? 'page' : undefined}
          className={() => cn('inline-flex h-11 items-center gap-2 rounded-full px-5 text-[15px] font-bold no-underline', x.id === current ? 'bg-on-surface text-white' : 'text-on-surface-variant hover:bg-surface-low')}>
          <x.icon size={17} aria-hidden />{x.label}
        </NavLink>
      ))}
    </nav>
  )
}
