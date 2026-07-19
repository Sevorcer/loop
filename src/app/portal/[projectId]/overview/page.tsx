import type { Metadata } from "next";

import { ProjectOverviewScreen } from "@/features/project-portal/screens/ProjectOverviewScreen";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return <ProjectOverviewScreen />;
}
