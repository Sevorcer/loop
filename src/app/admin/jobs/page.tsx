import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * /admin/jobs — legacy route redirect.
 *
 * Jobs are an operational entity. This path redirects to the Operations
 * shell for backward compatibility with existing bookmarks and deep links.
 */
export default function AdminJobsPage() {
  redirect(ROUTES.JOBS);
}
