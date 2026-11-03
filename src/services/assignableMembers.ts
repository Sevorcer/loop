import "server-only";

import type { AppRole } from "@/services/authorization";
import { listOrgUsers } from "@/services/settingsUsers";

export interface AssignableMember {
  id: string;
  name: string;
}

/**
 * App roles that may be assigned to a job. Every internal staff role — the
 * owner included — is assignable; only the external customer-portal role is
 * not. The owner was previously dropped by a tech-only filter on the picker;
 * including the full internal role set here is the fix.
 */
const ASSIGNABLE_ROLES = new Set<AppRole>([
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
]);

function memberName(user: { fullName: string | null; email: string }): string {
  return user.fullName?.trim() || user.email?.trim() || "Team member";
}

/**
 * People the job assignee picker can offer: active org members with a profile
 * whose role is assignable.
 *
 * The list is derived from the same profiles + auth-ban merge that powers
 * Settings > Users (listOrgUsers), so a deactivated or auth-banned login
 * (status "inactive") can never be assigned — it is excluded here with exactly
 * the active/inactive signal that screen uses. Imported Service Fusion name
 * variants are not profiles and so are never a source of assignable options;
 * the muted SF-name display fallback for historical jobs is unaffected.
 */
export async function listAssignableMembers(callerUserId: string): Promise<AssignableMember[]> {
  const users = await listOrgUsers(callerUserId);
  return users
    .filter((user) => user.status === "active" && ASSIGNABLE_ROLES.has(user.role))
    .map((user) => ({ id: user.id, name: memberName(user) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
