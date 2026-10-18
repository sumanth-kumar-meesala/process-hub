import type { Edge, Process, Step } from '@/lib/types'
import { FS25_GUIDE } from './guideSeed'

/**
 * Starter processes.
 * FS25 comes from the original mockup; its extra checks and edge cases were added in Process Hub.
 * The other four only had an outline in the mockups — their steps, checks and edge cases were drafted
 * in Process Hub and carry a note asking the owner to confirm them. Systems nobody named yet are
 * marked "[confirm] …" so the owner can say which real system it is.
 */
const now = '2026-10-16T12:00:00.000Z'

type S = [id: string, kind: Step['kind'], label: string, role: string, stage: string, res?: string[]]
/** Steps from a compact list, and links from "a>b  c>d:No" text. */
function flow(list: S[], links: string): { steps: Step[]; edges: Edge[] } {
  const steps = list.map(([id, kind, label, roleId, stageId, resourceIds]) => ({ id, kind, label, roleId, stageId, ...(resourceIds ? { resourceIds } : {}) }))
  const edges = links.trim().split(/\s+/).map((l, i) => {
    const [pair, label] = l.split(':')
    const [from, to] = pair.split('>')
    if (!steps.some((x) => x.id === from) || !steps.some((x) => x.id === to)) throw new Error(`seed link ${l} points to a missing step`)
    return { id: `e${i + 1}`, from, to, ...(label ? { label } : {}) }
  })
  return { steps, edges }
}

const fs25: Process = {
  id: 'fs25-client-specific-training',
  code: 'FS25',
  title: 'Client Specific Training',
  area: 'Client & Community',
  summary: "Makes sure workers get the training they need to safely support each client — in line with the client's support needs, their plan and our policies.",
  nutshell: "When a client's situation changes — they're new, they move house, their plan changes or there's an incident — the House Supervisor works out what training their workers need. L&D arranges it, a training provider delivers it, and everything is recorded in Lumary DC. It's done when workers are trained and the evidence is on file.",
  owner: 'Priya Sharma',
  executiveOwner: 'Daniel Brooks',
  reviewLast: '14 Aug 2024',
  reviewNext: '14 Aug 2026',
  status: 'published',
  needsCompleting: false,
  draftNote: 'The checks for funding, attendance, competency, missing evidence and urgent cases were added in Process Hub. Priya Sharma to confirm.',
  audience: 'Everyone involved in client service delivery — support workers, team leaders, support coordinators and training providers.',
  triggers: ['A new client joins', 'A client moves house', 'New staff start', "The client's plan (PSP) changes", "There's an incident", 'A plan review', "The client's needs change"],
  outcomes: ['Workers are trained to support this client', 'Training evidence is recorded and kept up to date', 'Client safety, quality and compliance needs are met'],
  roles: [
    { id: 'intake', name: 'Intake', color: '#7C3AED' },
    { id: 'hs', name: 'House Supervisor', color: '#2563EB' },
    { id: 'sc', name: 'Support Coordinator', color: '#0EA5E9' },
    { id: 'ld', name: 'L&D Coordinator', color: '#F97316' },
    { id: 'tp', name: 'Training Provider', color: '#15803D' },
    { id: 'dsw', name: 'Support Worker', color: '#DB2777' },
  ],
  stages: [
    { id: 's1', title: 'Work out what training this client needs', short: 'Identify needs', place: "the client's home", text: "Look at the client's information and support plan, check what workers can already do, and decide what they still need to learn to support the client safely.", color: '#2563EB', systems: ['Lumary DC', 'Client Records', 'HIDPA Dashboard', 'Training Matrix'], docs: [], roleIds: [], scene: 'home' },
    { id: 's2', title: 'Plan the training pathway and get it approved', short: 'Plan & approve', place: 'the head office', text: 'Confirm exactly which training is needed, check it is funded, and get approval before anything is booked.', color: '#DB2777', systems: ['Lumary DC', 'SharePoint'], docs: [], roleIds: [], scene: 'approval' },
    { id: 's3', title: 'Book the sessions, materials and trainer', short: 'Arrange training', place: 'the L&D team', text: 'L&D books a trainer and a date, assigns the course in Totara and sends invites to the workers.', color: '#16A34A', systems: ['Outlook', 'Teams', 'Totara LMS'], docs: [], roleIds: ['tp'], scene: 'calendar' },
    { id: 's4', title: 'Deliver the training and check skills', short: 'Deliver & assess', place: 'the training session', text: 'The training provider runs the session, records who attended, and confirms each support worker can do what is needed.', color: '#EA580C', systems: ['Totara LMS', 'Lumary DC'], docs: [], roleIds: [], scene: 'classroom' },
    { id: 's5', title: 'Record it and keep an eye on it', short: 'Record & monitor', place: 'Lumary DC', text: "Record completion and evidence, workers declare completion in Lumary DC, and the House Supervisor keeps watching compliance — escalating anything that slips.", color: '#7C3AED', systems: ['Totara LMS', 'Lumary DC', 'HIDPA Dashboard'], docs: [], roleIds: [], scene: 'report' },
  ],
  ...flow([
    ['start', 'start', 'Something changes for the client', 'intake', 's1'],
    ['a1', 'step', 'Review client information', 'intake', 's1', ['lib-doc-psp', 'lib-guide-lumary-record']],
    ['u1', 'decision', 'Safe to support as usual?', 'hs', 's1', ['lib-doc-incident-report', 'lib-policy-ndis-standards']],
    ['u2', 'step', 'Put interim safety measures in place', 'hs', 's1', ['lib-doc-incident-report', 'lib-proc-incident']],
    ['r1', 'step', 'Check worker readiness', 'hs', 's1', ['lib-guide-hidpa', 'lib-guide-training-matrix']],
    ['a2', 'step', 'Identify training needs', 'hs', 's1', ['lib-form-training-request', 'lib-policy-cst']],
    ['a3', 'step', 'Plan training pathway', 'hs', 's2', ['lib-form-pathway-approval', 'lib-policy-capability']],
    ['f1', 'decision', 'Funding confirmed?', 'sc', 's2', ['lib-doc-psp']],
    ['f2', 'step', 'Ask for funding or plan review', 'sc', 's2', ['lib-doc-psp', 'lib-proc-plan-review']],
    ['d1', 'decision', 'Approved?', 'sc', 's2', ['lib-form-pathway-approval', 'lib-policy-worker-training', 'lib-guide-sharepoint']],
    ['a4', 'step', 'Book sessions & trainer', 'ld', 's3', ['lib-form-session-plan', 'lib-guide-teams-schedule']],
    ['t1', 'decision', 'Trainer and date confirmed?', 'ld', 's3', ['lib-form-session-plan']],
    ['a9', 'step', 'Assign the course in Totara', 'ld', 's3', ['lib-guide-totara-assign']],
    ['a10', 'step', 'Send invites to workers', 'ld', 's3', ['lib-guide-outlook']],
    ['a5', 'step', 'Deliver & assess skills', 'tp', 's4', ['lib-guide-totara-assign', 'lib-policy-worker-training', 'lib-form-attendance']],
    ['v1', 'decision', 'Every worker attended?', 'tp', 's4', ['lib-form-attendance']],
    ['v2', 'step', 'Reschedule missed workers', 'ld', 's4', ['lib-guide-teams-schedule']],
    ['a6', 'step', 'Complete the training', 'dsw', 's4', ['lib-doc-evidence-checklist']],
    ['c1', 'decision', 'Worker competent?', 'tp', 's4', ['lib-form-competency', 'lib-policy-capability']],
    ['a7', 'step', 'Record completion', 'ld', 's5', ['lib-doc-training-record', 'lib-doc-evidence-checklist', 'lib-guide-lumary-record']],
    ['e1', 'decision', 'Evidence complete?', 'ld', 's5', ['lib-doc-evidence-checklist']],
    ['e2', 'step', 'Chase missing evidence', 'ld', 's5', ['lib-doc-evidence-checklist']],
    ['a11', 'step', 'Declare completion in Lumary DC', 'dsw', 's5', ['lib-guide-lumary-record']],
    ['a8', 'step', 'Monitor compliance', 'hs', 's5', ['lib-policy-ndis-standards', 'lib-policy-cst', 'lib-guide-hidpa']],
    ['m1', 'decision', 'Still compliant?', 'hs', 's5', ['lib-policy-ndis-standards']],
    ['m2', 'step', 'Escalate non-compliance', 'hs', 's5', ['lib-policy-workforce', 'lib-proc-incident']],
    ['end', 'end', 'Workers trained, evidence on file', 'hs', 's5'],
  ], `start>a1 a1>u1 u1>r1:Yes u1>u2:No u2>r1 r1>a2 a2>a3 a3>f1 f1>d1:Yes f1>f2:No f2>a3 d1>a4:Yes d1>a3:No
      a4>t1 t1>a9:Yes t1>a4:No a9>a10 a10>a5 a5>v1 v1>a6:Yes v1>v2:No v2>a10 a6>c1 c1>a7:Yes c1>a5:No
      a7>e1 e1>a11:Yes e1>e2:No e2>a7 a11>a8 a8>m1 m1>end:Yes m1>m2:No m2>a2`),
  exceptions: [
    { case: "The client isn't safe to support as usual (for example after an incident)", handled: 'Put interim safety measures in place' },
    { case: 'Some workers already have the training', handled: 'Check worker readiness — only the gaps go into the plan' },
    { case: "The training isn't funded in the client's plan", handled: 'Ask for funding or plan review' },
    { case: "The pathway isn't approved", handled: 'Approved? — back to Plan training pathway' },
    { case: 'No trainer or date is available', handled: 'Trainer and date confirmed? — book again' },
    { case: 'A worker misses the session', handled: 'Reschedule missed workers' },
    { case: "A worker isn't competent yet", handled: 'Worker competent? — deliver and assess again' },
    { case: 'Attendance or competency evidence is missing', handled: 'Chase missing evidence' },
    { case: 'Compliance slips later (training expires, needs change)', handled: 'Escalate non-compliance — back to Identify training needs' },
  ],
  resources: [],
  linkedIds: ['lib-policy-cst', 'lib-policy-worker-training', 'lib-policy-ndis-standards', 'lib-policy-workforce', 'lib-proc-new-client', 'lib-proc-incident', 'lib-proc-plan-review', 'lib-proc-onboarding'],
  roleDetails: [
    {
      roleId: 'hs',
      summary: 'You make sure workers finish the client-specific training they need, and that the training evidence and compliance checks stay up to date.',
      responsibilities: ['Working out what training is needed', 'Coordinating the training', 'Keeping training records', 'Checking compliance', "Responding when a client's needs change"],
      byTrigger: [
        { trigger: 'New client', color: '#2563EB', actions: [{ text: 'Review training requirements', system: 'Lumary DC' }, { text: 'Confirm workers are ready', system: 'HIDPA Dashboard' }] },
        { trigger: 'New staff', color: '#EA580C', actions: [{ text: 'Identify training needed', system: 'Training Matrix' }, { text: 'Confirm they can do the role', system: 'Lumary DC' }] },
        { trigger: 'Plan review', color: '#0EA5E9', actions: [{ text: 'Review PSP updates', system: 'Lumary DC' }, { text: 'Check training impact', system: 'SharePoint' }] },
        { trigger: 'Incident', color: '#DC2626', actions: [{ text: 'Review what happened', system: 'Lumary DC' }, { text: 'Check support impact', system: 'Teams' }] },
        { trigger: 'Needs change', color: '#DB2777', actions: [{ text: 'Review health changes', system: 'Lumary DC' }, { text: 'Check support impact', system: 'SharePoint' }] },
      ],
      rules: ["Training must match the client's needs", 'Get approval before training is booked', 'Keep the evidence', 'Mandatory training is completed', 'Escalate anything not compliant'],
      systems: ['Lumary DC', 'SharePoint', 'Teams', 'HIDPA Dashboard', 'Training Matrix'],
      documents: ['Attendance Sheet', 'Training Request', 'Competency Form', 'PSP Documents'],
      policies: ['Workforce Policy', 'Training Policy', 'NDIS Standards', 'Capability Framework'],
    },
  ],
  ownerDetail: {
    processMaps: 3,
    activities: 18,
    pendingChanges: 2,
    scope: ['New clients', 'New staff', 'Plan reviews', 'Incidents', 'Client needs changing'],
    outcomes: ['Workers trained', 'Evidence maintained', 'Compliance monitored', 'Safe, effective support for clients'],
    risks: ['Training not completed', 'Training not recorded', 'Requirements overlooked', 'Not meeting NDIS standards', 'Client support affected'],
    accountable: ['Process design', 'Policy alignment', 'Compliance oversight', 'Business rules', 'Review & sign-off', 'Improvement'],
    consulted: ['System changes', 'Regulatory changes', 'Audit findings', 'New training needs'],
    approves: ['Process updates', 'Rule changes', 'Exceptions', 'Major design decisions'],
    upstream: ['Client intake', 'Client assessment', 'PSP management'],
    downstream: ['Support delivery', 'Workforce capability', 'Compliance reporting'],
    controls: ['Requirements identified', 'Linked to client needs', 'Funding confirmed', 'Attendance recorded', 'Competency assessed', 'Completion declared', 'Dashboard monitored', 'Non-compliance escalated'],
    changes: [
      { date: 'Aug 2026', text: 'Lumary DC declaration model added' },
      { date: 'Jul 2026', text: 'HIDPA dashboard improved' },
      { date: 'Jun 2026', text: 'Review trigger updated' },
      { date: 'Apr 2026', text: 'Training request workflow changed' },
    ],
    raci: [
      { role: 'House Supervisor', level: 'Responsible' },
      { role: 'Support Coordinator', level: 'Responsible' },
      { role: 'Support Worker', level: 'Consulted' },
      { role: 'L&D Coordinator', level: 'Consulted' },
      { role: 'CPA', level: 'Consulted' },
      { role: 'Training Provider', level: 'Informed' },
    ],
  },
  updatedAt: now,
  seeded: true,
}

const drafted = (owner: string) => `The steps, checks and edge cases were drafted in Process Hub from the outline in the mockups. ${owner} should confirm them, and say which real system each “?” is.`
const base = { resources: [], roleDetails: [], updatedAt: now, seeded: true, status: 'published' as const, needsCompleting: false }

const onboarding: Process = {
  ...base,
  id: 'new-employee-onboarding',
  title: 'New Employee Onboarding',
  area: 'People & Culture',
  summary: "Covers everything from signed contract to the new joiner's 30-day check-in, across HR, IT, L&D and the hiring manager.",
  nutshell: "It starts when a candidate signs their contract. The hiring manager asks for onboarding, HR sets the person up and checks their worker screening, IT gets accounts and equipment ready, and the first week covers induction and mandatory training. It's done when the new starter is productive, compliant and checked in at 30 days.",
  owner: 'HR Operations',
  draftNote: drafted('HR Operations'),
  audience: 'Hiring managers, HR, IT, L&D and every new starter.',
  triggers: ['A candidate signs their employment contract'],
  outcomes: ['The new starter has their accounts, equipment and induction on day one', 'Worker screening and mandatory training are done before client work', 'The new starter is productive, compliant and checked in at 30 days'],
  roles: [
    { id: 'hm', name: 'Hiring Manager', color: '#2563EB' },
    { id: 'hr', name: 'HR Operations', color: '#15803D' },
    { id: 'it', name: 'IT Service Desk', color: '#7C3AED' },
    { id: 'ld', name: 'L&D Coordinator', color: '#0EA5E9' },
    { id: 'nj', name: 'New Joiner', color: '#F97316' },
  ],
  stages: [
    { id: 'o1', title: 'Ask for the new starter to be onboarded', short: 'Request', place: 'the hiring team', text: 'The hiring manager sends the onboarding request with the role, start date and what the person will need.', color: '#2563EB', systems: ['SharePoint'], docs: [], roleIds: [], scene: 'message' },
    { id: 'o2', title: 'Set the new starter up in HR', short: 'HR set-up', place: 'HR Operations', text: 'HR collects the starter’s details, checks worker screening, creates the employee record and sets up payroll.', color: '#16A34A', systems: ['[confirm] HR system', '[confirm] Payroll system', 'SharePoint'], docs: [], roleIds: [], scene: 'consent' },
    { id: 'o3', title: 'Get IT ready', short: 'IT set-up', place: 'IT Service Desk', text: 'IT creates the accounts and system access the role needs and prepares the laptop and phone before day one.', color: '#7C3AED', systems: ['[confirm] IT service portal', 'Outlook', 'Teams', 'Lumary DC', 'Totara LMS'], docs: [], roleIds: [], scene: 'records' },
    { id: 'o4', title: 'First week', short: 'First week', place: 'the workplace', text: 'A welcome, an induction, and mandatory training — the new starter is confirmed ready before any client work.', color: '#EA580C', systems: ['Outlook', 'Teams', 'Totara LMS', 'Training Matrix', 'HIDPA Dashboard'], docs: [], roleIds: [], scene: 'classroom' },
    { id: 'o5', title: 'Check in at 30 days', short: '30-day check-in', place: 'the hiring team', text: 'The manager checks how the new starter is settling in and agrees extra support if needed.', color: '#0EA5E9', systems: ['Teams', '[confirm] HR system'], docs: [], roleIds: [], scene: 'meeting' },
  ],
  ...flow([
    ['start', 'start', 'Candidate signs their contract', 'hm', 'o1'],
    ['n1', 'step', 'Submit onboarding request', 'hm', 'o1', ['lib-form-onboarding-request', 'lib-guide-sharepoint']],
    ['q1', 'decision', 'Request complete?', 'hr', 'o1', ['lib-form-onboarding-request']],
    ['n4', 'step', 'Collect new starter details', 'nj', 'o2', ['lib-form-new-starter', 'lib-policy-privacy']],
    ['q2', 'decision', 'Worker screening cleared?', 'hr', 'o2', ['lib-policy-onboarding', 'lib-policy-ndis-standards']],
    ['n5', 'step', 'Hold client work until cleared', 'hr', 'o2', ['lib-policy-onboarding']],
    ['n2', 'step', 'Create employee master record', 'hr', 'o2', ['lib-form-new-starter', 'lib-policy-privacy']],
    ['n3', 'step', 'Register for payroll and benefits', 'hr', 'o2', ['lib-form-new-starter']],
    ['n6', 'step', 'Raise IT access request', 'hm', 'o3', ['lib-form-it-access']],
    ['n7', 'step', 'Create accounts and system access', 'it', 'o3', ['lib-form-it-access', 'lib-policy-privacy']],
    ['n8', 'step', 'Prepare laptop and phone', 'it', 'o3', ['lib-form-it-access']],
    ['q3', 'decision', 'Ready before day one?', 'it', 'o3', ['lib-form-it-access']],
    ['n9', 'step', 'Arrange temporary access and equipment', 'it', 'o3', ['lib-form-it-access']],
    ['n10', 'step', 'Send welcome and first-week plan', 'hm', 'o4', ['lib-guide-outlook', 'lib-form-induction']],
    ['n11', 'step', 'Run induction', 'hm', 'o4', ['lib-form-induction', 'lib-policy-onboarding', 'lib-policy-workforce']],
    ['n12', 'step', 'Assign mandatory training', 'ld', 'o4', ['lib-guide-totara-assign', 'lib-guide-training-matrix']],
    ['n13', 'step', 'Complete mandatory training', 'nj', 'o4', ['lib-guide-totara-assign', 'lib-policy-worker-training']],
    ['q4', 'decision', 'Mandatory training done on time?', 'ld', 'o4', ['lib-guide-training-matrix']],
    ['n14', 'step', 'Send reminder, then tell the manager', 'ld', 'o4', ['lib-guide-outlook']],
    ['n15', 'step', 'Confirm ready in HIDPA Dashboard', 'hm', 'o4', ['lib-guide-hidpa']],
    ['n16', 'step', 'Hold 30-day check-in', 'hm', 'o5', ['lib-form-30-day']],
    ['q5', 'decision', 'Settling in well?', 'hm', 'o5', ['lib-form-30-day', 'lib-policy-onboarding']],
    ['n17', 'step', 'Agree a support plan with HR', 'hr', 'o5', ['lib-policy-onboarding']],
    ['n18', 'step', 'Close onboarding in HR system', 'hr', 'o5', ['lib-form-30-day']],
    ['end', 'end', 'Productive, compliant, checked in', 'hr', 'o5'],
  ], `start>n1 n1>q1 q1>n4:Yes q1>n1:No n4>q2 q2>n2:Yes q2>n5:No n5>n2 n2>n3 n3>n6 n6>n7 n7>n8 n8>q3 q3>n10:Yes q3>n9:No n9>n10
      n10>n11 n11>n12 n12>n13 n13>q4 q4>n15:Yes q4>n14:No n14>n13 n15>n16 n16>q5 q5>n18:Yes q5>n17:No n17>n18 n18>end`),
  exceptions: [
    { case: 'The onboarding request is missing details', handled: 'Request complete? — back to the hiring manager' },
    { case: "Worker screening hasn't cleared by the start date", handled: 'Hold client work until cleared' },
    { case: "Laptop, phone or access isn't ready for day one", handled: 'Arrange temporary access and equipment' },
    { case: "Mandatory training isn't done on time", handled: 'Send reminder, then tell the manager' },
    { case: 'Starting client work before being ready', handled: 'Confirm ready in HIDPA Dashboard' },
    { case: "The new starter isn't settling in", handled: 'Agree a support plan with HR' },
    { case: 'Personal, tax and bank details must stay private', handled: 'Collect new starter details (Privacy policy)' },
  ],
  linkedIds: ['lib-policy-onboarding', 'lib-policy-privacy', 'lib-policy-workforce', 'lib-proc-fs25', 'lib-proc-exit'],
}

const exit: Process = {
  ...base,
  id: 'employee-exit-offboarding',
  title: 'Employee Exit & Offboarding',
  area: 'People & Culture',
  summary: 'What happens from the moment someone resigns or their contract ends, through handover, final pay and return of equipment and access.',
  nutshell: "The employee gives notice, the manager confirms the last day and plans the handover — including moving their clients to other workers. Payroll works out final pay, the employee returns their equipment, and IT removes their access on the last day. It's done when nothing is left open.",
  owner: 'HR Operations',
  draftNote: drafted('HR Operations'),
  audience: 'Every employee who leaves, their line manager, HR, Payroll and IT.',
  triggers: ['Someone resigns', 'A contract ends'],
  outcomes: ['Work is handed over and clients have a new worker', 'Final pay and leave owed are correct and on time', 'Equipment is returned and all system access is removed', 'Employee records are archived securely'],
  roles: [
    { id: 'emp', name: 'Employee', color: '#F97316' },
    { id: 'lm', name: 'Line Manager', color: '#2563EB' },
    { id: 'hr', name: 'HR Operations', color: '#15803D' },
    { id: 'pay', name: 'Payroll', color: '#DB2777' },
    { id: 'it', name: 'IT Service Desk', color: '#7C3AED' },
  ],
  stages: [
    { id: 'x1', title: 'Resignation or contract end', short: 'Leaving', place: 'the team', text: 'The employee gives notice, the manager confirms the last day, and HR records the exit. A high-risk exit has access removed straight away.', color: '#2563EB', systems: ['[confirm] HR system', 'Outlook'], docs: [], roleIds: [], scene: 'message' },
    { id: 'x2', title: 'Handover', short: 'Handover', place: 'the team', text: 'The employee hands over their work and the manager moves their clients to other workers in Lumary DC.', color: '#DB2777', systems: ['Lumary DC', 'SharePoint', 'Teams'], docs: [], roleIds: [], scene: 'handover' },
    { id: 'x3', title: 'Final pay', short: 'Final pay', place: 'HR Operations', text: 'Payroll works out final pay and leave owed, HR checks it, and it is paid with the separation letter.', color: '#16A34A', systems: ['[confirm] Payroll system', 'Outlook'], docs: [], roleIds: [], scene: 'payment' },
    { id: 'x4', title: 'Return equipment and access', short: 'Return access', place: 'IT Service Desk', text: 'Equipment comes back, every system account is closed on the last day, and the file is archived.', color: '#7C3AED', systems: ['[confirm] IT service portal', 'Lumary DC', 'Totara LMS', 'Outlook', 'Teams', 'SharePoint'], docs: [], roleIds: [], scene: 'archive' },
  ],
  ...flow([
    ['start', 'start', 'Someone resigns or a contract ends', 'emp', 'x1'],
    ['x1a', 'step', 'Give written notice', 'emp', 'x1', ['lib-form-exit-notice']],
    ['x1b', 'step', 'Confirm last day and notice', 'lm', 'x1', ['lib-form-exit-notice', 'lib-policy-separation']],
    ['x1c', 'step', 'Record the exit in HR system', 'hr', 'x1', ['lib-form-exit-notice']],
    ['k1', 'decision', 'Low-risk exit?', 'hr', 'x1', ['lib-policy-privacy']],
    ['x1d', 'step', 'Remove access immediately', 'it', 'x1', ['lib-policy-privacy', 'lib-form-it-access']],
    ['x2a', 'step', 'Agree handover plan', 'lm', 'x2', ['lib-form-handover']],
    ['x2b', 'step', 'Reassign clients in Lumary DC', 'lm', 'x2', ['lib-guide-lumary-record', 'lib-form-handover']],
    ['k2', 'decision', 'Handover complete?', 'lm', 'x2', ['lib-form-handover']],
    ['x2c', 'step', 'Hold exit interview', 'hr', 'x2', ['lib-form-exit-interview']],
    ['x3a', 'step', 'Calculate final pay and leave owed', 'pay', 'x3', ['lib-policy-separation', 'lib-policy-leave']],
    ['k3', 'decision', 'Final pay checked?', 'hr', 'x3', ['lib-policy-separation']],
    ['x3b', 'step', 'Pay and send separation letter', 'pay', 'x3', ['lib-policy-separation', 'lib-guide-outlook']],
    ['x4a', 'step', 'Return laptop, phone and ID', 'emp', 'x4', ['lib-form-equipment-return']],
    ['k4', 'decision', 'All equipment returned?', 'it', 'x4', ['lib-form-equipment-return']],
    ['x4b', 'step', 'Follow up missing equipment', 'lm', 'x4', ['lib-form-equipment-return']],
    ['x4c', 'step', 'Remove all system access', 'it', 'x4', ['lib-policy-privacy', 'lib-form-it-access']],
    ['x4d', 'step', 'Archive the employee file', 'hr', 'x4', ['lib-policy-privacy', 'lib-guide-sharepoint']],
    ['end', 'end', 'Nothing left open', 'hr', 'x4'],
  ], `start>x1a x1a>x1b x1b>x1c x1c>k1 k1>x2a:Yes k1>x1d:No x1d>x2a x2a>x2b x2b>k2 k2>x2c:Yes k2>x2a:No x2c>x3a
      x3a>k3 k3>x3b:Yes k3>x3a:No x3b>x4a x4a>k4 k4>x4c:Yes k4>x4b:No x4b>x4a x4c>x4d x4d>end`),
  exceptions: [
    { case: 'Someone leaves suddenly, is dismissed or is a security risk', handled: 'Remove access immediately' },
    { case: 'Clients would be left without a worker', handled: 'Reassign clients in Lumary DC' },
    { case: "The handover isn't finished by the last day", handled: 'Handover complete? — back to the handover plan' },
    { case: 'Final pay or leave owed is wrong', handled: 'Final pay checked? — Payroll recalculates' },
    { case: "Equipment isn't returned", handled: 'Follow up missing equipment' },
    { case: 'Accounts left open after they leave', handled: 'Remove all system access' },
    { case: 'Their records must be kept securely', handled: 'Archive the employee file (Privacy policy)' },
  ],
  linkedIds: ['lib-policy-separation', 'lib-policy-privacy', 'lib-policy-leave', 'lib-proc-onboarding', 'lib-proc-leave'],
}

const leave: Process = {
  ...base,
  id: 'leave-request-approval',
  title: 'Leave Request & Approval',
  area: 'People & Culture',
  summary: 'How an employee requests annual, personal or unpaid leave, how it is approved, and how cover and payroll are arranged.',
  nutshell: "The employee checks their balance and asks for leave. Their manager checks team cover and decides within two working days — HR chases if not. Shifts are covered so clients aren't affected, and Payroll updates pay. It's done when the employee is back, or their leave is extended the same way.",
  owner: 'HR Operations',
  draftNote: drafted('HR Operations'),
  audience: 'Every employee and line manager, HR and Payroll.',
  triggers: ['An employee needs annual, personal or unpaid leave'],
  outcomes: ['Leave is approved or declined, with a reason, within two working days', 'Shifts are covered and clients are not affected', 'Pay and leave balance are correct'],
  roles: [
    { id: 'emp', name: 'Employee', color: '#F97316' },
    { id: 'lm', name: 'Line Manager', color: '#2563EB' },
    { id: 'hr', name: 'HR Operations', color: '#15803D' },
    { id: 'pay', name: 'Payroll', color: '#7C3AED' },
  ],
  stages: [
    { id: 'l1', title: 'Request leave', short: 'Request', place: 'the employee', text: 'The employee checks their balance and sends a leave request, with evidence for personal leave.', color: '#2563EB', systems: ['[confirm] HR system'], docs: [], roleIds: [], scene: 'message' },
    { id: 'l2', title: 'Approve the leave', short: 'Approve', place: 'the line manager', text: 'The manager checks cover and dates and decides within two working days. HR chases if no decision is made.', color: '#DB2777', systems: ['[confirm] HR system', 'Outlook', '[confirm] Rostering system'], docs: [], roleIds: [], scene: 'approval' },
    { id: 'l3', title: 'Arrange cover and payroll', short: 'Cover & payroll', place: 'HR and Payroll', text: 'Shifts are covered so clients are not affected, and Payroll updates pay — as unpaid leave if the balance is short.', color: '#16A34A', systems: ['[confirm] Rostering system', 'Lumary DC', '[confirm] Payroll system', 'Outlook'], docs: [], roleIds: [], scene: 'payment' },
    { id: 'l4', title: 'Back at work', short: 'Return', place: 'the team', text: 'The employee returns on the planned date, or asks to extend their leave the same way.', color: '#EA580C', systems: ['[confirm] HR system'], docs: [], roleIds: [], scene: 'finish' },
  ],
  ...flow([
    ['start', 'start', 'Employee needs leave', 'emp', 'l1'],
    ['y1', 'step', 'Check leave balance', 'emp', 'l1', ['lib-policy-leave']],
    ['y2', 'step', 'Submit leave request', 'emp', 'l1', ['lib-form-leave-request', 'lib-policy-leave']],
    ['y3', 'step', 'Check dates and team cover', 'lm', 'l2', ['lib-form-cover-plan']],
    ['w1', 'decision', 'Decided within 2 working days?', 'hr', 'l2', ['lib-policy-leave']],
    ['y4', 'step', 'Send reminder, then escalate', 'hr', 'l2', ['lib-guide-outlook']],
    ['w2', 'decision', 'Leave approved?', 'lm', 'l2', ['lib-policy-leave']],
    ['y5', 'step', 'Discuss other dates', 'lm', 'l2', ['lib-policy-leave']],
    ['w3', 'decision', 'Evidence given if needed?', 'hr', 'l2', ['lib-form-medical-cert', 'lib-policy-leave']],
    ['y6', 'step', 'Ask for a medical certificate', 'hr', 'l2', ['lib-form-medical-cert']],
    ['y7', 'step', 'Arrange cover for shifts', 'lm', 'l3', ['lib-form-cover-plan', 'lib-guide-lumary-record']],
    ['w4', 'decision', 'Cover found?', 'lm', 'l3', ['lib-form-cover-plan']],
    ['y8', 'step', 'Escalate cover to HR', 'hr', 'l3', ['lib-form-cover-plan']],
    ['w5', 'decision', 'Enough leave balance?', 'pay', 'l3', ['lib-policy-leave']],
    ['y9', 'step', 'Process as unpaid leave', 'pay', 'l3', ['lib-policy-leave']],
    ['y10', 'step', 'Update payroll and confirm', 'pay', 'l3', ['lib-guide-outlook']],
    ['w6', 'decision', 'Back on the planned date?', 'lm', 'l4', ['lib-policy-leave']],
    ['y11', 'step', 'Request an extension', 'emp', 'l4', ['lib-form-leave-request']],
    ['end', 'end', 'Leave taken, pay correct', 'hr', 'l4'],
  ], `start>y1 y1>y2 y2>y3 y3>w1 w1>w2:Yes w1>y4:No y4>y3 w2>w3:Yes w2>y5:No y5>y2 w3>y7:Yes w3>y6:No y6>w3
      y7>w4 w4>w5:Yes w4>y8:No y8>y7 w5>y10:Yes w5>y9:No y9>y10 y10>w6 w6>end:Yes w6>y11:No y11>y3`),
  exceptions: [
    { case: "The manager doesn't decide in time", handled: 'Send reminder, then escalate' },
    { case: 'The dates clash or are declined', handled: 'Discuss other dates' },
    { case: 'Personal leave without evidence', handled: 'Ask for a medical certificate' },
    { case: "Nobody can cover the shifts (clients affected)", handled: 'Escalate cover to HR' },
    { case: "There isn't enough leave balance", handled: 'Process as unpaid leave' },
    { case: 'The employee is sick or needs more time', handled: 'Request an extension — goes back to approval' },
  ],
  linkedIds: ['lib-policy-leave', 'lib-proc-exit'],
}

const p2p: Process = {
  ...base,
  id: 'purchase-requisition-to-payment',
  title: 'Purchase Requisition to Payment',
  area: 'Finance & Procurement',
  summary: 'End-to-end indirect procurement covering requisition, approval, purchase order creation, goods receipt and invoice settlement. Applies to all indirect spend below EUR 50,000.',
  nutshell: "Someone who needs to buy something gets quotes and raises a requisition. The cost centre manager approves it within their authority, Procurement checks the supplier and sends the purchase order, the requester confirms what arrived, and Accounts Payable pays the invoice once it matches the order and receipt.",
  owner: 'Procurement Excellence',
  draftNote: drafted('Procurement Excellence'),
  audience: 'Anyone who buys goods or services, cost centre managers, Procurement and Accounts Payable.',
  triggers: ['Someone needs to buy something (indirect spend below EUR 50,000)'],
  outcomes: ['Spend is approved by the right person and recorded', 'Goods or services arrive as ordered', 'The supplier is paid correctly and on time'],
  roles: [
    { id: 'req', name: 'Requester', color: '#F97316' },
    { id: 'ccm', name: 'Cost Centre Manager', color: '#2563EB' },
    { id: 'proc', name: 'Procurement', color: '#15803D' },
    { id: 'sup', name: 'Supplier', color: '#DB2777' },
    { id: 'ap', name: 'Accounts Payable', color: '#7C3AED' },
  ],
  stages: [
    { id: 'p1', title: 'Requisition', short: 'Requisition', place: 'the requester', text: 'The requester gets quotes from preferred suppliers and raises a requisition. Anything over EUR 50,000 goes to strategic sourcing instead.', color: '#2563EB', systems: ['[confirm] Finance system', 'SharePoint'], docs: [], roleIds: [], scene: 'review' },
    { id: 'p2', title: 'Approval', short: 'Approval', place: 'the cost centre', text: 'The cost centre manager checks budget and approves within their authority, or passes it up.', color: '#DB2777', systems: ['[confirm] Finance system'], docs: [], roleIds: [], scene: 'approval' },
    { id: 'p3', title: 'Purchase order', short: 'Purchase order', place: 'Procurement', text: 'Procurement checks the supplier is approved — onboarding and checking new ones — then sends the purchase order.', color: '#16A34A', systems: ['[confirm] Finance system', 'Outlook'], docs: [], roleIds: [], scene: 'message' },
    { id: 'p4', title: 'Goods receipt', short: 'Goods receipt', place: 'the requester', text: 'The requester checks what arrived against the order and confirms the receipt.', color: '#EA580C', systems: ['[confirm] Finance system'], docs: [], roleIds: [], scene: 'delivery' },
    { id: 'p5', title: 'Invoice settlement', short: 'Pay invoice', place: 'Accounts Payable', text: 'Accounts Payable matches the invoice to the order and receipt, checks bank details, and pays on the due date.', color: '#7C3AED', systems: ['[confirm] Finance system', 'SharePoint'], docs: [], roleIds: [], scene: 'payment' },
  ],
  ...flow([
    ['start', 'start', 'Someone needs to buy something', 'req', 'p1'],
    ['z1', 'step', 'Get quotes from preferred suppliers', 'req', 'p1', ['lib-form-quotes', 'lib-policy-procurement']],
    ['g1', 'decision', 'Under EUR 50,000?', 'req', 'p1', ['lib-policy-procurement']],
    ['z2', 'step', 'Send to strategic sourcing', 'proc', 'p1', ['lib-policy-procurement']],
    ['z3', 'step', 'Raise purchase requisition', 'req', 'p1', ['lib-form-requisition']],
    ['g2', 'decision', 'Budget available?', 'ccm', 'p2', ['lib-policy-delegation']],
    ['z4', 'step', 'Revise or cancel the request', 'req', 'p2', ['lib-form-requisition']],
    ['g3', 'decision', 'Within my approval limit?', 'ccm', 'p2', ['lib-policy-delegation']],
    ['z5', 'step', 'Escalate to the next approver', 'ccm', 'p2', ['lib-policy-delegation']],
    ['g4', 'decision', 'Approved supplier?', 'proc', 'p3', ['lib-policy-procurement']],
    ['z6', 'step', 'Onboard and check new supplier', 'proc', 'p3', ['lib-form-new-supplier', 'lib-policy-conflict']],
    ['z7', 'step', 'Create and send purchase order', 'proc', 'p3', ['lib-guide-outlook']],
    ['z8', 'step', 'Deliver goods or service', 'sup', 'p4'],
    ['g5', 'decision', 'Received as ordered?', 'req', 'p4', ['lib-form-goods-receipt']],
    ['z9', 'step', 'Raise issue with supplier', 'proc', 'p4', ['lib-form-goods-receipt']],
    ['z10', 'step', 'Confirm goods receipt', 'req', 'p4', ['lib-form-goods-receipt']],
    ['z11', 'step', 'Send invoice', 'sup', 'p5'],
    ['g6', 'decision', 'Invoice matches order and receipt?', 'ap', 'p5', ['lib-form-goods-receipt']],
    ['z12', 'step', 'Resolve mismatch with supplier', 'ap', 'p5'],
    ['g7', 'decision', 'Bank details unchanged?', 'ap', 'p5', ['lib-policy-procurement']],
    ['z13', 'step', 'Verify bank details by phone', 'ap', 'p5', ['lib-form-new-supplier']],
    ['z14', 'step', 'Pay on the due date', 'ap', 'p5', ['lib-policy-procurement']],
    ['z15', 'step', 'File invoice and remittance', 'ap', 'p5', ['lib-guide-sharepoint']],
    ['end', 'end', 'Supplier paid, spend recorded', 'ap', 'p5'],
  ], `start>z1 z1>g1 g1>z3:Yes g1>z2:No z2>end z3>g2 g2>g3:Yes g2>z4:No z4>z3 g3>g4:Yes g3>z5:No z5>g4
      g4>z7:Yes g4>z6:No z6>z7 z7>z8 z8>g5 g5>z10:Yes g5>z9:No z9>z8 z10>z11 z11>g6 g6>g7:Yes g6>z12:No z12>z11
      g7>z14:Yes g7>z13:No z13>z14 z14>z15 z15>end`),
  exceptions: [
    { case: 'The purchase is EUR 50,000 or more', handled: 'Send to strategic sourcing' },
    { case: "There's no budget for it", handled: 'Revise or cancel the request' },
    { case: "It's above the manager's approval limit", handled: 'Escalate to the next approver' },
    { case: "The supplier isn't set up yet (or has a conflict of interest)", handled: 'Onboard and check new supplier' },
    { case: 'Wrong, short or damaged delivery', handled: 'Raise issue with supplier' },
    { case: "The invoice doesn't match the order or receipt", handled: 'Resolve mismatch with supplier' },
    { case: 'The supplier says their bank details changed (possible fraud)', handled: 'Verify bank details by phone' },
  ],
  linkedIds: ['lib-policy-procurement', 'lib-policy-delegation', 'lib-policy-conflict'],
}

/** Adds the drafted "why", "how" and must-have documents to steps that don't have their own yet. */
export const withGuide = (p: Process): Process => p.id !== fs25.id ? p : {
  ...p, steps: p.steps.map((s) => {
    const g = FS25_GUIDE[s.id]
    return g ? { ...s, why: s.why ?? g.why, how: s.how ?? g.how, mustIds: s.mustIds ?? g.mustIds.filter((id) => (s.resourceIds ?? []).includes(id)) } : s
  }),
}

export const SEED: Process[] = [withGuide(fs25), onboarding, exit, leave, p2p]
