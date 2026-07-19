import { redirect } from "next/navigation";
<<<<<<< HEAD
import { DEMO_PROJECT_ID } from "@/features/project-portal/data/mockPortalProjects";
import { PORTAL_ROUTES } from "@/lib/routes";

/**
 * Portal home — redirects to the demo project for the mock session.
 * In production, this would resolve the user's active project(s) and
 * present a project selector or redirect to the sole active project.
 */
export default function PortalHomePage() {
  redirect(PORTAL_ROUTES.PROJECT(DEMO_PROJECT_ID));
=======

import { MOCK_ACTIVE_USER } from "@/features/project-portal/data/mockPortalUsers";
import { mockProjects } from "@/features/project-portal/data/mockProjects";
import { getAccessibleProjects } from "@/features/project-portal/auth/portalAuth";
import { PORTAL_ROUTES } from "@/lib/routes";

/**
 * Portal root — redirects to the first accessible project for the mock user.
 * In production this would be the user's project dashboard.
 */
export default function PortalRootPage() {
  const accessible = getAccessibleProjects(MOCK_ACTIVE_USER, mockProjects);

  if (accessible.length > 0) {
    redirect(PORTAL_ROUTES.OVERVIEW(accessible[0].id));
  }

  redirect(PORTAL_ROUTES.ERROR_UNAUTHORIZED);
>>>>>>> origin/main
}
