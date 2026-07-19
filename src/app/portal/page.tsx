import { redirect } from "next/navigation";
import { DEMO_PROJECT_ID } from "@/features/project-portal/data/mockPortalProjects";
import { PORTAL_ROUTES } from "@/lib/routes";

/**
 * Portal home — redirects to the demo project for the mock session.
 * In production, this would resolve the user's active project(s) and
 * present a project selector or redirect to the sole active project.
 */
export default function PortalHomePage() {
  redirect(PORTAL_ROUTES.PROJECT(DEMO_PROJECT_ID));
}
