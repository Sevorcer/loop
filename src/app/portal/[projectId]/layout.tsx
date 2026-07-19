<<<<<<< HEAD
import { PortalProvider } from "@/features/project-portal/state/PortalProvider";
import { PortalShell } from "@/features/project-portal/components/PortalShell";

interface PortalProjectLayoutProps {
  children: React.ReactNode;
=======
import type { ReactNode } from "react";

import { PortalProvider } from "@/features/project-portal/state/PortalProvider";
import { PortalNav } from "@/features/project-portal/components/PortalNav";
import { PortalErrorState } from "@/features/project-portal/components/PortalErrorState";
import { mockProjects } from "@/features/project-portal/data/mockProjects";
import { MOCK_ACTIVE_USER } from "@/features/project-portal/data/mockPortalUsers";
import { authorizePortalAccess } from "@/features/project-portal/auth/portalAuth";

interface ProjectLayoutProps {
  children: ReactNode;
>>>>>>> origin/main
  params: Promise<{ projectId: string }>;
}

/**
<<<<<<< HEAD
 * Project-scoped portal layout.
 *
 * Wraps all portal project sub-routes in PortalProvider (with the project
 * pre-selected) and PortalShell (nav chrome + auth error interception).
 */
export default async function PortalProjectLayout({
  children,
  params,
}: PortalProjectLayoutProps) {
  const { projectId } = await params;

  return (
    <PortalProvider projectId={projectId}>
      <PortalShell>{children}</PortalShell>
=======
 * Project-scoped layout.
 *
 * Resolves auth + role gating BEFORE rendering children.
 * Any error code triggers the appropriate error state (no children shown).
 *
 * Architecture note: auth check is enforced here (server-side in production).
 * In Sprint 22A with mock data it runs on the server during render.
 */
export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { projectId } = await params;

  const project = mockProjects.find((p) => p.id === projectId) ?? null;

  // Missing project check
  if (!project) {
    return <PortalErrorState code="missing_project" />;
  }

  const authResult = authorizePortalAccess(MOCK_ACTIVE_USER, project);

  // Authorization checks
  if (!authResult.ok) {
    return <PortalErrorState code={authResult.errorCode} />;
  }

  const { permissionSet } = authResult;

  return (
    <PortalProvider projectId={projectId}>
      <div className="space-y-4 sm:space-y-6">
        {/* Project name */}
        <div>
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">
            {project.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {project.address}
          </p>
        </div>

        {/* Tab navigation */}
        <PortalNav
          projectId={projectId}
          canViewTimeline={permissionSet.canViewTimeline}
          canViewDocuments={permissionSet.canViewDocuments}
        />

        {/* Screen content */}
        <div>{children}</div>
      </div>
>>>>>>> origin/main
    </PortalProvider>
  );
}
