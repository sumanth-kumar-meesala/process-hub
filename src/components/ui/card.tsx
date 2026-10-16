import * as React from 'react'
import { cn } from '@/lib/utils'
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-[24px] bg-white p-6', className)} {...p} />
)
export const Tag = ({ className, color, children, ...p }: React.HTMLAttributes<HTMLSpanElement> & { color?: string }) => (
  <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-low px-3 text-[13px] font-semibold', className)} {...p}>
    {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
    {children}
  </span>
)
