import type { Process } from '@/lib/types'

/**
 * Starter processes. Only content taken from the Scope / KPMG mockups is used.
 * FS25 is complete; the other four only had partial information in the mockups,
 * so they are flagged `needsCompleting` for their owners to finish in the Builder.
 */
const now = '2026-10-16T00:00:00.000Z'

const fs25: Process = {
  id: 'fs25-client-specific-training',
  code: 'FS25',
  title: 'Client Specific Training',
  area: 'Client & Community',
  summary: "Makes sure workers get the training they need to safely support each client — in line with the client's support needs, their plan and Scope policies.",
  nutshell: "When a client's situation changes — they're new, they move house, their plan changes or there's an incident — the House Supervisor works out what training their workers need. L&D arranges it, a training provider delivers it, and everything is recorded in Lumary DC. It's done when workers are trained and the evidence is on file.",
  owner: 'Erin Hannah',
  executiveOwner: 'Evan Westgarth',
  reviewLast: '14 Aug 2024',
  reviewNext: '14 Aug 2026',
  status: 'published',
  needsCompleting: false,
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
    { id: 's1', title: 'Work out what training this client needs', short: 'Identify needs', place: "the client's home", text: "Look at the client's information and support plan, and decide what workers need to learn to support them safely.", color: '#2563EB', systems: ['Lumary DC', 'Client Records'], docs: ['Client Support Plan', 'Training Request Form'], roleIds: [], scene: 'home' },
    { id: 's2', title: 'Plan the training pathway and get it approved', short: 'Plan & approve', place: 'the Scope office', text: 'Confirm exactly which training is needed and get approval before anything is booked.', color: '#DB2777', systems: ['Lumary DC', 'SharePoint'], docs: ['Training Pathway Approval'], roleIds: [], scene: 'office' },
    { id: 's3', title: 'Book the sessions, materials and trainer', short: 'Arrange training', place: 'the L&D team', text: 'L&D organises the sessions, the materials and a training provider, and sends invites to the workers.', color: '#16A34A', systems: ['Outlook', 'Teams'], docs: ['Session Plan Template'], roleIds: ['tp'], scene: 'calendar' },
    { id: 's4', title: 'Deliver the training and check skills', short: 'Deliver & assess', place: 'the training session', text: 'The training provider runs the session and confirms each support worker can do what is needed.', color: '#EA580C', systems: ['Totara LMS', 'Lumary DC'], docs: ['Attendance Sheet', 'Competency Form'], roleIds: [], scene: 'classroom' },
    { id: 's5', title: 'Record it and keep an eye on it', short: 'Record & monitor', place: 'Lumary DC', text: "Update the client record, keep the evidence, and review again whenever the client's needs change.", color: '#7C3AED', systems: ['Totara LMS', 'Lumary DC'], docs: ['Client Training Record', 'Evidence Checklist'], roleIds: [], scene: 'records' },
  ],
  steps: [
    { id: 'start', kind: 'start', label: 'Something changes for the client', roleId: 'intake', stageId: 's1' },
    { id: 'a1', kind: 'step', label: 'Review client information', roleId: 'intake', stageId: 's1' },
    { id: 'a2', kind: 'step', label: 'Identify training needs', roleId: 'hs', stageId: 's1' },
    { id: 'a3', kind: 'step', label: 'Plan training pathway', roleId: 'hs', stageId: 's2' },
    { id: 'd1', kind: 'decision', label: 'Approved?', roleId: 'sc', stageId: 's2' },
    { id: 'a4', kind: 'step', label: 'Book sessions & trainer', roleId: 'ld', stageId: 's3' },
    { id: 'a5', kind: 'step', label: 'Deliver & assess skills', roleId: 'tp', stageId: 's4' },
    { id: 'a6', kind: 'step', label: 'Complete the training', roleId: 'dsw', stageId: 's4' },
    { id: 'a7', kind: 'step', label: 'Record completion', roleId: 'ld', stageId: 's5' },
    { id: 'a8', kind: 'step', label: 'Monitor compliance', roleId: 'hs', stageId: 's5' },
    { id: 'end', kind: 'end', label: 'Workers trained, evidence on file', roleId: 'hs', stageId: 's5' },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'a1' },
    { id: 'e2', from: 'a1', to: 'a2' },
    { id: 'e3', from: 'a2', to: 'a3' },
    { id: 'e4', from: 'a3', to: 'd1' },
    { id: 'e5', from: 'd1', to: 'a4', label: 'Yes' },
    { id: 'e6', from: 'd1', to: 'a3', label: 'No' },
    { id: 'e7', from: 'a4', to: 'a5' },
    { id: 'e8', from: 'a5', to: 'a6' },
    { id: 'e9', from: 'a6', to: 'a7' },
    { id: 'e10', from: 'a7', to: 'a8' },
    { id: 'e11', from: 'a8', to: 'end' },
  ],
  resources: [
    { id: 'r1', title: 'Forms & templates', note: '3 to fill in', color: '#2563EB', items: ['Training Request Form', 'Training Pathway Approval', 'Session Plan Template'] },
    { id: 'r2', title: 'Client documents', note: 'Kept in Lumary DC', color: '#DB2777', items: ['Client Support Plan (PSP)', 'Client Training Record', 'Training Evidence Checklist'] },
    { id: 'r3', title: 'How-to guides', note: 'Step-by-step for systems', color: '#16A34A', items: ['Lumary DC — client record', 'Totara — assign training', 'Teams — schedule sessions'] },
    { id: 'r4', title: 'Policies', note: 'The rules behind it', color: '#EA580C', items: ['Client Specific Training Policy', 'Worker Training Policy', 'NDIS Practice Standards'] },
    { id: 'r5', title: 'Related processes', note: 'Linked work', color: '#7C3AED', items: ['New Client Onboarding', 'Incident Management', 'Plan Review'] },
  ],
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

const blank = { resources: [], roleDetails: [], edges: [], updatedAt: now, seeded: true, status: 'published' as const, needsCompleting: true }

const onboarding: Process = {
  ...blank,
  id: 'new-employee-onboarding',
  title: 'New Employee Onboarding',
  area: 'People & Culture',
  summary: "Covers everything from signed contract to the end of the new joiner's first week, across HR, IT and the hiring manager.",
  nutshell: 'New Employee Onboarding kicks off when a candidate signs their employment contract. It takes about 9 steps and involves 4 teams. You\'ll know it\'s done when the new starter is productive, compliant and checked in at 30 days.',
  owner: 'HR Operations',
  triggers: ['A candidate signs their employment contract'],
  outcomes: ['The new starter is productive, compliant and checked in at 30 days'],
  roles: [
    { id: 'hm', name: 'Hiring Manager', color: '#2563EB' },
    { id: 'hr', name: 'HR Operations', color: '#15803D' },
    { id: 'it', name: 'IT Service Desk', color: '#7C3AED' },
    { id: 'nj', name: 'New Joiner', color: '#F97316' },
  ],
  stages: [
    { id: 'o1', title: 'Ask for the new starter to be onboarded', short: 'Request', place: 'the hiring team', text: 'The hiring manager submits the onboarding request.', color: '#2563EB', systems: [], docs: [], roleIds: ['hm'], scene: 'office' },
    { id: 'o2', title: 'Set the new starter up in HR', short: 'HR set-up', place: 'HR Operations', text: 'HR creates the employee master record and registers them for payroll and benefits.', color: '#16A34A', systems: [], docs: [], roleIds: ['hr'], scene: 'records' },
    { id: 'o3', title: 'Get IT ready', short: 'IT set-up', place: 'IT Service Desk', text: '[To be completed by the owner]', color: '#7C3AED', systems: [], docs: [], roleIds: ['it'], scene: 'generic' },
    { id: 'o4', title: 'First week', short: 'First week', place: 'the workplace', text: '[To be completed by the owner]', color: '#EA580C', systems: [], docs: [], roleIds: ['nj'], scene: 'classroom' },
  ],
  steps: [
    { id: 'n1', kind: 'step', label: 'Submit onboarding request', roleId: 'hm', stageId: 'o1' },
    { id: 'n2', kind: 'step', label: 'Create employee master record', roleId: 'hr', stageId: 'o2' },
    { id: 'n3', kind: 'step', label: 'Register for payroll and benefits', roleId: 'hr', stageId: 'o2' },
  ],
  edges: [{ id: 'ne1', from: 'n1', to: 'n2' }, { id: 'ne2', from: 'n2', to: 'n3' }],
}

const exit: Process = {
  ...blank,
  id: 'employee-exit-offboarding',
  title: 'Employee Exit & Offboarding',
  area: 'People & Culture',
  summary: 'What happens from the moment someone resigns or their contract ends, through handover, final pay and return of equipment and access.',
  nutshell: 'What happens from the moment someone resigns or their contract ends, through handover, final pay and return of equipment and access.',
  owner: 'HR Operations',
  triggers: ['Someone resigns', 'A contract ends'],
  outcomes: [],
  roles: [
    { id: 'emp', name: 'Employee', color: '#F97316' },
    { id: 'lm', name: 'Line Manager', color: '#2563EB' },
    { id: 'hr', name: 'HR Operations', color: '#15803D' },
    { id: 'it', name: 'IT Service Desk', color: '#7C3AED' },
  ],
  stages: [
    { id: 'x1', title: 'Resignation or contract end', short: 'Leaving', place: 'the team', text: '[To be completed by the owner]', color: '#2563EB', systems: [], docs: [], roleIds: ['emp', 'lm'], scene: 'office' },
    { id: 'x2', title: 'Handover', short: 'Handover', place: 'the team', text: '[To be completed by the owner]', color: '#DB2777', systems: [], docs: [], roleIds: ['emp', 'lm'], scene: 'generic' },
    { id: 'x3', title: 'Final pay', short: 'Final pay', place: 'HR Operations', text: '[To be completed by the owner]', color: '#16A34A', systems: [], docs: [], roleIds: ['hr'], scene: 'payment' },
    { id: 'x4', title: 'Return equipment and access', short: 'Return access', place: 'IT Service Desk', text: '[To be completed by the owner]', color: '#7C3AED', systems: [], docs: [], roleIds: ['it'], scene: 'records' },
  ],
  steps: [],
}

const leave: Process = {
  ...blank,
  id: 'leave-request-approval',
  title: 'Leave Request & Approval',
  area: 'People & Culture',
  summary: 'How an employee requests annual, personal or unpaid leave, how it is approved, and how cover and payroll are arranged.',
  nutshell: 'How an employee requests annual, personal or unpaid leave, how it is approved, and how cover and payroll are arranged.',
  owner: 'HR Operations',
  triggers: ['An employee needs annual, personal or unpaid leave'],
  outcomes: [],
  roles: [
    { id: 'emp', name: 'Employee', color: '#F97316' },
    { id: 'lm', name: 'Line Manager', color: '#2563EB' },
    { id: 'hr', name: 'HR Operations', color: '#15803D' },
    { id: 'pay', name: 'Payroll', color: '#7C3AED' },
  ],
  stages: [
    { id: 'l1', title: 'Request leave', short: 'Request', place: 'the employee', text: '[To be completed by the owner]', color: '#2563EB', systems: [], docs: [], roleIds: ['emp'], scene: 'home' },
    { id: 'l2', title: 'Approve the leave', short: 'Approve', place: 'the line manager', text: '[To be completed by the owner]', color: '#DB2777', systems: [], docs: [], roleIds: ['lm'], scene: 'office' },
    { id: 'l3', title: 'Arrange cover and payroll', short: 'Cover & payroll', place: 'HR and Payroll', text: '[To be completed by the owner]', color: '#16A34A', systems: [], docs: [], roleIds: ['hr', 'pay'], scene: 'payment' },
  ],
  steps: [],
}

const p2p: Process = {
  ...blank,
  id: 'purchase-requisition-to-payment',
  title: 'Purchase Requisition to Payment',
  area: 'Finance & Procurement',
  summary: 'End-to-end indirect procurement covering requisition, approval, purchase order creation, goods receipt and invoice settlement. Applies to all indirect spend below EUR 50,000.',
  nutshell: 'End-to-end indirect procurement covering requisition, approval, purchase order creation, goods receipt and invoice settlement. Applies to all indirect spend below EUR 50,000.',
  owner: 'Procurement Excellence',
  triggers: ['Someone needs to buy something (indirect spend below EUR 50,000)'],
  outcomes: [],
  roles: [
    { id: 'req', name: 'Requester', color: '#F97316' },
    { id: 'ccm', name: 'Cost Centre Manager', color: '#2563EB' },
    { id: 'proc', name: 'Procurement', color: '#15803D' },
    { id: 'ap', name: 'Accounts Payable', color: '#7C3AED' },
  ],
  stages: [
    { id: 'p1', title: 'Requisition', short: 'Requisition', place: 'the requester', text: '[To be completed by the owner]', color: '#2563EB', systems: [], docs: [], roleIds: ['req'], scene: 'office' },
    { id: 'p2', title: 'Approval', short: 'Approval', place: 'the cost centre', text: '[To be completed by the owner]', color: '#DB2777', systems: [], docs: [], roleIds: ['ccm'], scene: 'office' },
    { id: 'p3', title: 'Purchase order', short: 'Purchase order', place: 'Procurement', text: '[To be completed by the owner]', color: '#16A34A', systems: [], docs: [], roleIds: ['proc'], scene: 'records' },
    { id: 'p4', title: 'Goods receipt', short: 'Goods receipt', place: 'the requester', text: '[To be completed by the owner]', color: '#EA580C', systems: [], docs: [], roleIds: ['req'], scene: 'delivery' },
    { id: 'p5', title: 'Invoice settlement', short: 'Pay invoice', place: 'Accounts Payable', text: '[To be completed by the owner]', color: '#7C3AED', systems: [], docs: [], roleIds: ['ap'], scene: 'payment' },
  ],
  steps: [],
}

export const SEED: Process[] = [fs25, onboarding, exit, leave, p2p]
