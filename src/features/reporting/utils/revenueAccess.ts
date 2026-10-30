const REVENUE_ROLES = new Set(["owner", "manager", "dispatch", "office"]);

/**
 * Owner, manager, dispatch, and office may see revenue reports and edit a
 * job price. Technicians, sales, and portal users must not.
 */
export function canSeeJobRevenue(role: string | null | undefined): boolean {
  return typeof role === "string" && REVENUE_ROLES.has(role);
}

/** A technician may read the price on an assigned job, but not the reports. */
export function canViewJobPrice(role: string | null | undefined): boolean {
  return canSeeJobRevenue(role) || role === "tech";
}
