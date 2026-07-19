import { redirect } from "next/navigation";

import { PORTAL_ROUTES } from "@/lib/routes";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectRootPage({ params }: PageProps) {
  const { projectId } = await params;
  redirect(PORTAL_ROUTES.OVERVIEW(projectId));
}
