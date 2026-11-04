import "server-only";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";
import { getCurrentOperator } from "@/services/currentOperator";

import { isRoleDeniedPath } from "./shellAccess";

/**
 * Redirect users whose role is denied access to the given path.
 * Checks the current operator's role against the role-based denied-path map.
 *
 * @deprecated name kept for call-site compatibility — now enforces all roles,
 * not just tech.
 */
export async function redirectTechFromOfficePath(pathname: string): Promise<void> {
  let appRole: string | null = null;
  try {
    appRole = (await getCurrentOperator()).appRole;
  } catch {
    // Static generation has no Supabase env. Middleware still enforces the role
    // on the live request.
    return;
  }

  if (isRoleDeniedPath(appRole, pathname)) {
    redirect(ROUTES.JOBS);
  }
}
