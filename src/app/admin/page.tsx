import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "@/lib/routes";

/**
 * /admin root — redirect to the Organizations list.
 * The primary admin landing page is Organizations.
 */
export default function AdminRootPage() {
  redirect(ADMIN_ROUTES.ORGANIZATIONS);
}
