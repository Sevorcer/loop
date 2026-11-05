import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * Command Center was renamed "Operations" (2026-11-05) and now lives at
 * /operations. Keep this address so old bookmarks and links still land on it.
 */
export default function CommandCenterPage() {
  redirect(ROUTES.OPERATIONS);
}
