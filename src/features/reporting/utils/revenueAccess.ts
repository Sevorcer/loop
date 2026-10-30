/**
 * One list for revenue. These roles may see production reports, export the
 * CSV, call the reports API, and enter or edit a job price.
 * A technician can read a price on an assigned job and cannot see reports.
 * Portal users cannot see prices or reports.
 */
export const JOB_REVENUE_ROLES = ["owner", "manager", "dispatch", "office", "sales"] as const;

const REVENUE_ROLES = new Set<string>(JOB_REVENUE_ROLES);

/** Owner, manager, dispatch, office, and sales may see revenue and edit a job price. */
export function canSeeJobRevenue(role: string | null | undefined): boolean {
  return typeof role === "string" && REVENUE_ROLES.has(role);
}

/** A technician may read the price on an assigned job, but not the reports. */
export function canViewJobPrice(role: string | null | undefined): boolean {
  return canSeeJobRevenue(role) || role === "tech";
}
