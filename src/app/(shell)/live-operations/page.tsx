import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * Live Operations is being rebuilt on real data inside Operations
 * (2026-11-05). Until the Live view ships, send old links to Operations.
 */
export default function LiveOperationsPage() {
  redirect(ROUTES.OPERATIONS);
}
