export interface InternalSystem { name: string; purpose: string }

/** The organisation's own systems. The AI asks about these and uses these exact names. */
export const SEED_SYSTEMS: InternalSystem[] = [
  { name: 'Lumary DC', purpose: 'Client records, support plans (PSP), case notes and training records' },
  { name: 'Totara LMS', purpose: 'Assigning courses and recording training completion' },
  { name: 'SharePoint', purpose: 'Shared documents, templates and approvals' },
  { name: 'Outlook', purpose: 'Email and calendar invites' },
  { name: 'Teams', purpose: 'Meetings, chat and online sessions' },
  { name: 'HIDPA Dashboard', purpose: 'Worker readiness and compliance' },
  { name: 'Training Matrix', purpose: 'Which workers have which training' },
]
