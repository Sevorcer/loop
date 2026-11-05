import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * Live Operations was rebuilt on real data as the Live tab inside
 * Operations (2026-11-05). Old links land there.
 */
export default function LiveOperationsPage() {
  redirect(ROUTES.OPERATIONS_LIVE);
}
