import type { LibraryItem } from '@/lib/types'

/** The shared resource library, seeded from the original mockups. */
export const SEED_LIBRARY: LibraryItem[] = [
  { id: 'lib-form-training-request', title: 'Training Request Form', category: 'form', tags: ['training', 'request', 'needs', 'identify'] },
  { id: 'lib-form-pathway-approval', title: 'Training Pathway Approval', category: 'form', tags: ['pathway', 'plan', 'approve', 'approval', 'sign off'] },
  { id: 'lib-form-session-plan', title: 'Session Plan Template', category: 'form', tags: ['session', 'book', 'schedule', 'materials', 'arrange'] },
  { id: 'lib-doc-psp', title: 'Client Support Plan (PSP)', category: 'client-doc', tags: ['client', 'support', 'plan', 'psp', 'needs', 'information', 'review'] },
  { id: 'lib-doc-training-record', title: 'Client Training Record', category: 'client-doc', tags: ['record', 'completion', 'training', 'evidence', 'lumary'] },
  { id: 'lib-doc-evidence-checklist', title: 'Training Evidence Checklist', category: 'client-doc', tags: ['evidence', 'checklist', 'complete', 'completion', 'compliance'] },
  { id: 'lib-guide-lumary-record', title: 'Lumary DC — client record', category: 'guide', tags: ['lumary', 'lumary dc', 'client', 'record', 'information', 'update'] },
  { id: 'lib-guide-totara-assign', title: 'Totara — assign training', category: 'guide', tags: ['totara', 'lms', 'training', 'assign', 'deliver', 'course'] },
  { id: 'lib-guide-teams-schedule', title: 'Teams — schedule sessions', category: 'guide', tags: ['teams', 'outlook', 'schedule', 'book', 'session', 'invite', 'meeting'] },
  { id: 'lib-policy-cst', title: 'Client Specific Training Policy', category: 'policy', tags: ['client', 'training', 'needs', 'compliance'] },
  { id: 'lib-policy-worker-training', title: 'Worker Training Policy', category: 'policy', tags: ['worker', 'staff', 'training', 'approval', 'competency'] },
  { id: 'lib-policy-ndis-standards', title: 'NDIS Practice Standards', category: 'policy', tags: ['ndis', 'standards', 'compliance', 'quality', 'monitor', 'safety'] },
  { id: 'lib-proc-new-client', title: 'New Client Onboarding', category: 'process', tags: ['new client', 'onboarding', 'intake'] },
  { id: 'lib-proc-incident', title: 'Incident Management', category: 'process', tags: ['incident', 'risk'] },
  { id: 'lib-proc-plan-review', title: 'Plan Review', category: 'process', tags: ['plan review', 'psp', 'review'] },
]
