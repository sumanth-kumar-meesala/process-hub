import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { ListTree, type LucideIcon } from 'lucide-react'
import type { GuideRun } from '@/lib/guide'
import type { Process } from '@/lib/types'

export interface GuideViewProps { proc: Process; run: GuideRun }
export interface GuideView { id: string; label: string; blurb: string; icon: LucideIcon; View: LazyExoticComponent<ComponentType<GuideViewProps>> }

/** The guided ways to read a process. Each one shows the same Builder data, laid out differently. */
export const GUIDE_VIEWS: GuideView[] = [
  { id: 'timeline', label: 'Timeline', blurb: 'Every step down the left, the chosen step on the right', icon: ListTree, View: lazy(() => import('./TimelineView')) },
]
