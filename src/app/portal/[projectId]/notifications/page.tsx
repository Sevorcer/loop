import type { Metadata } from "next";
import { PortalNotificationsScreen } from "@/features/project-portal/screens/PortalNotificationsScreen";

export const metadata: Metadata = { title: "Notifications" };

export default function PortalNotificationsPage() {
  return <PortalNotificationsScreen />;
}
