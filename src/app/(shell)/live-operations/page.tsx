import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * Live Operations is parked (2026-09-30) — the tab runs on hardcoded mock
 * crews/jobs and is hidden from the nav. Redirect to Dispatch so any
 * bookmarked or linked URL lands somewhere real. Restore by rendering
 * <LiveOperationsScreen /> again.
 */
export default function LiveOperationsPage() {
  redirect(ROUTES.DISPATCH);
}
