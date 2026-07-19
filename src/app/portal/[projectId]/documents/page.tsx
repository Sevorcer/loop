import type { Metadata } from "next";

import { DocumentsScreen } from "@/features/project-portal/screens/DocumentsScreen";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <DocumentsScreen />;
}
