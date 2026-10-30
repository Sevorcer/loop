/**
 * Feedback inbox rules from the QA pass.
 * Triage (mark triaged / resolved / dismiss, and Save in the drawer) is for
 * the office. Technicians can still delete a report they wrote.
 */

export function showFeedbackTriageActions(role: string | null | undefined): boolean {
  return role !== "tech";
}

export function canDeleteFeedbackReport(
  role: string | null | undefined,
  userId: string | null | undefined,
  report: { createdByUserId: string | null },
): boolean {
  if (role === "owner") return true;
  return Boolean(userId) && report.createdByUserId === userId;
}
