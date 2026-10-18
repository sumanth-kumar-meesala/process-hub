/**
 * FS25: "Why it matters", "How to do it" and the must-have documents for each step.
 * Drafted in Process Hub for the guided pages — Priya Sharma to confirm.
 */
export const FS25_GUIDE: Record<string, { why: string; how: string[]; mustIds: string[] }> = {
  a1: { why: "So the training matches what this client really needs.", how: ["Open the client's record in Lumary DC", "Read the support plan (PSP) and any recent notes or incidents", "Note anything new: health, behaviours, equipment, routines"], mustIds: ["lib-doc-psp"] },
  u1: { why: "Nobody is put at risk while the training is sorted.", how: ["Look at recent incidents and risks in the client record", "Decide if workers can support the client safely today", "If not, answer No \u2014 safety measures come first"], mustIds: ["lib-doc-incident-report"] },
  u2: { why: "Keeps the client and workers safe until training is done.", how: [], mustIds: ["lib-doc-incident-report"] },
  r1: { why: "Nobody is trained on what they already know.", how: ["Open the HIDPA Dashboard for the client's team", "Check the Training Matrix for what this client needs", "List the gaps for each worker"], mustIds: ["lib-guide-hidpa", "lib-guide-training-matrix"] },
  a2: { why: "Turns the gaps into one clear training request.", how: ["Fill in the Training Request Form", "Say who needs what, and by when", "Check it against the Client Specific Training Policy"], mustIds: ["lib-form-training-request"] },
  a3: { why: "One agreed plan means training is booked once, correctly.", how: ["Write the pathway on the Training Pathway Approval form", "Match each item to the Capability Framework", "Send it to the Support Coordinator"], mustIds: ["lib-form-pathway-approval"] },
  f2: { why: "Gets the funding sorted instead of stopping the training.", how: ["Ask for the funding, or request a plan review", "Record the request in Lumary DC"], mustIds: ["lib-doc-psp"] },
  d1: { why: "Approval before booking avoids wasted sessions.", how: ["Review the pathway against the Worker Training Policy", "Approve or decline it in SharePoint", "If you decline, add a reason so it can be fixed"], mustIds: ["lib-form-pathway-approval"] },
  a4: { why: "Workers get trained at a time that suits their rosters.", how: ["Find a training provider and a date", "Book a room or a Teams session", "Fill in the Session Plan Template"], mustIds: ["lib-form-session-plan"] },
  t1: { why: "No invites go out for a session that might not happen.", how: ["Check the trainer has confirmed in writing", "Check the date suits the workers' rosters"], mustIds: ["lib-form-session-plan"] },
  a9: { why: "Completion is tracked automatically.", how: ["Open Totara and find the course", "Assign it to each worker who needs it"], mustIds: ["lib-guide-totara-assign"] },
  a10: { why: "Everyone knows when, where and what to bring.", how: ["Send the invite from Outlook with the date, place and what to bring", "Ask workers to accept"], mustIds: [] },
  a5: { why: "Workers learn the skills and show they can use them.", how: ["Run the session", "Mark attendance on the Attendance Sheet", "Assess each worker's skills"], mustIds: ["lib-form-attendance"] },
  v1: { why: "Nobody is left untrained by accident.", how: ["Compare the Attendance Sheet with the invite list"], mustIds: ["lib-form-attendance"] },
  v2: { why: "Missed workers still get trained.", how: ["Find a new date for the workers who missed it", "Send them a new invite"], mustIds: [] },
  c1: { why: "Only workers who can do it safely support the client.", how: ["Check each worker with the Competency Form", "Yes if they can do it safely, No means more training"], mustIds: ["lib-form-competency"] },
  e1: { why: "Audits need complete evidence.", how: ["Check the evidence checklist is complete for every worker"], mustIds: ["lib-doc-evidence-checklist"] },
  e2: { why: "Gaps are fixed before an audit finds them.", how: ["Ask the worker or trainer for what's missing", "Set a date to have it in"], mustIds: ["lib-doc-evidence-checklist"] },
  a11: { why: "Your record shows you can support this client.", how: ["Open the client in Lumary DC", "Declare that you've completed the training"], mustIds: ["lib-guide-lumary-record"] },
  a8: { why: "Training stays current as things change.", how: ["Check the HIDPA Dashboard regularly", "Watch for expiring training or changed needs"], mustIds: ["lib-guide-hidpa"] },
  m1: { why: "Catches problems before they affect the client.", how: ["Yes if everyone is still trained for this client", "No if training expired or the client's needs changed"], mustIds: ["lib-policy-ndis-standards"] },
  m2: { why: "Problems get fixed, not forgotten.", how: ["Tell your manager and record the issue", "Start the training needs check again"], mustIds: ["lib-policy-workforce"] },
  f1: { why: "Training only goes ahead if the client's plan pays for it.", how: ["Check the funding in the client's support plan (PSP)", "Yes if it's covered, No if it isn't"], mustIds: ["lib-doc-psp"] },
  a6: { why: "You're ready to support this client safely.", how: ["Finish any online parts in Totara", "Hand in the Training Evidence Checklist"], mustIds: ["lib-doc-evidence-checklist"] },
  a7: { why: "There's proof the training happened.", how: ["Record completion in the Client Training Record", "Attach the evidence in Lumary DC"], mustIds: ["lib-doc-training-record", "lib-doc-evidence-checklist"] },
}
