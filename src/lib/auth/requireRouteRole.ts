import "server-only";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";
import { getCurrentOperator } from "@/services/currentOperator";

import { isTechDeniedPath } from "./shellAccess";

/** Send technicians away from office-only screens. Other roles are unchanged. */
export async function redirectTechFromOfficePath(pathname: string): Promise<void> {
  if (!isTechDeniedPath(pathname)) return;

  let appRole: string | null = null;
  try {
    appRole = (await getCurrentOperator()).appRole;
  } catch {
    // Static generation has no Supabase env. Middleware still enforces the role
    // on the live request.
    return;
  }

  if (appRole === "tech") {
    redirect(ROUTES.JOBS);
  }
}
