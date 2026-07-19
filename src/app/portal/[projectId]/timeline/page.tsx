import type { Metadata } from "next";

import { TimelineScreen } from "@/features/project-portal/screens/TimelineScreen";

export const metadata: Metadata = { title: "Timeline" };

export default function TimelinePage() {
  return <TimelineScreen />;
}
