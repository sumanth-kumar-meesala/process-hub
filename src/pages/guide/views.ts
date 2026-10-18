import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { Footprints, ListChecks, ListTree, type LucideIcon } from 'lucide-react'
import type { GuideRun } from '@/lib/guide'
import type { Process } from '@/lib/types'

export interface GuideViewProps { proc: Process; run: GuideRun }
export interface GuideView { id: string; label: string; blurb: string; icon: LucideIcon; View: LazyExoticComponent<ComponentType<GuideViewProps>> }

/** The guided ways to read a process. Each one shows the same Builder data, laid out differently. */
export const GUIDE_VIEWS: GuideView[] = [
  { id: 'timeline', label: 'Timeline', blurb: 'Every step down the left, the chosen step on the right', icon: ListTree, View: lazy(() => import('./TimelineView')) },
  { id: 'checklist', label: 'Checklist', blurb: 'A plain list to tick off, with how-to on each step', icon: ListChecks, View: lazy(() => import('./ChecklistView')) },
  { id: 'steps', label: 'One step at a time', blurb: 'Pick who you are, then one step per screen with one big button', icon: Footprints, View: lazy(() => import('./StepsView')) },
]
