import type { Metadata } from "next";
import { PortalTimelineScreen } from "@/features/project-portal/screens/PortalTimelineScreen";

export const metadata: Metadata = { title: "Timeline" };

export default function PortalTimelinePage() {
  return <PortalTimelineScreen />;
}
