const REVENUE_ROLES = new Set(["owner", "manager", "office"]);

/** Owner, manager, and office may see job revenue. Technicians must not. */
export function canSeeJobRevenue(role: string | null | undefined): boolean {
  return typeof role === "string" && REVENUE_ROLES.has(role);
}
