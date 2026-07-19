import type { Metadata } from "next";
import { PortalOverviewScreen } from "@/features/project-portal/screens/PortalOverviewScreen";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return <PortalOverviewScreen />;
}
