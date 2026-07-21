import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * /admin/customers — legacy route redirect.
 *
 * Customers are an operational entity. This path redirects to the Operations
 * shell for backward compatibility with existing bookmarks and deep links.
 */
export default function AdminCustomersPage() {
  redirect(ROUTES.CUSTOMERS);
}
