import { AdminLandingScreen } from "@/features/admin";

/**
 * /admin root — Administration governance landing page.
 *
 * Displays the governance/configuration hub for platform administrators.
 * Operational entities (Jobs, Customers, Properties) are in the Operations
 * shell at their own routes.
 */
export default function AdminRootPage() {
  return <AdminLandingScreen />;
}
