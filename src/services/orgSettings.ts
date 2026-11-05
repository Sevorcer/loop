import "server-only";

import { canSeeJobRevenue } from "@/features/reporting/utils/revenueAccess";
import { readOrgSetting, writeOrgSetting } from "@/repositories/orgSettings";
import type { AppRole } from "@/services/authorization";

/**
 * Who may see financial detail and revenue totals (Collin, 2026-11-04):
 * Karl-only by default. The owner (main admin) account may loosen it in
 * Settings; nobody else can change it.
 *
 * - "owner":         owner role only (the ruling)
 * - "owner_manager": owner + manager
 * - "revenue_roles": the legacy JOB_REVENUE_ROLES set
 */
export type FinancialsVisibility = "owner" | "owner_manager" | "revenue_roles";

export const FINANCIALS_VISIBILITY_KEY = "financials_visibility";
export const DEFAULT_FINANCIALS_VISIBILITY: FinancialsVisibility = "owner";

const VALID = new Set<string>(["owner", "owner_manager", "revenue_roles"]);

export function parseFinancialsVisibility(raw: unknown): FinancialsVisibility {
  return typeof raw === "string" && VALID.has(raw)
    ? (raw as FinancialsVisibility)
    : DEFAULT_FINANCIALS_VISIBILITY;
}

/** Pure gate used by every money surface. */
export function canSeeFinancials(
  role: AppRole | string | null | undefined,
  visibility: FinancialsVisibility,
): boolean {
  if (role === "owner") return true;
  if (visibility === "owner_manager") return role === "manager";
  if (visibility === "revenue_roles") return canSeeJobRevenue(role);
  return false;
}

export async function getFinancialsVisibility(): Promise<FinancialsVisibility> {
  try {
    return parseFinancialsVisibility(
      await readOrgSetting(FINANCIALS_VISIBILITY_KEY),
    );
  } catch {
    // Fail closed: a settings read error degrades to owner-only, never open.
    return DEFAULT_FINANCIALS_VISIBILITY;
  }
}

function denied(): Error {
  return Object.assign(new Error("Only the owner can change this setting."), {
    status: 403,
  });
}

export async function setFinancialsVisibilityForRole(
  role: AppRole,
  userId: string | null,
  value: unknown,
): Promise<FinancialsVisibility> {
  if (role !== "owner") throw denied();
  const parsed = parseFinancialsVisibility(value);
  await writeOrgSetting(FINANCIALS_VISIBILITY_KEY, parsed, userId);
  return parsed;
}
