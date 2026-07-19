<<<<<<< HEAD
import type { Metadata } from "next";
import { PortalOverviewScreen } from "@/features/project-portal/screens/PortalOverviewScreen";

export const metadata: Metadata = { title: "Overview" };

export default function PortalOverviewPage() {
  return <PortalOverviewScreen />;
=======
import { redirect } from "next/navigation";

import { PORTAL_ROUTES } from "@/lib/routes";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectRootPage({ params }: PageProps) {
  const { projectId } = await params;
  redirect(PORTAL_ROUTES.OVERVIEW(projectId));
>>>>>>> origin/main
}
