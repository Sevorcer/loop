import { PortalProvider } from "@/features/project-portal/state/PortalProvider";
import { PortalShell } from "@/features/project-portal/components/PortalShell";

interface PortalProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

/**
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
    </PortalProvider>
  );
}
