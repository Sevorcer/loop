import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * /admin/properties — legacy route redirect.
 *
 * Properties are an operational entity. This path redirects to the Operations
 * shell for backward compatibility with existing bookmarks and deep links.
 */
export default function AdminPropertiesPage() {
  redirect(ROUTES.PROPERTIES);
}
