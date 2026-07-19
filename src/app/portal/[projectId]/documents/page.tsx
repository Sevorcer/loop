import type { Metadata } from "next";
import { PortalDocumentsScreen } from "@/features/project-portal/screens/PortalDocumentsScreen";

export const metadata: Metadata = { title: "Documents" };

export default function PortalDocumentsPage() {
  return <PortalDocumentsScreen />;
}
