import type { Metadata } from "next";
import { PortalContactScreen } from "@/features/project-portal/screens/PortalContactScreen";

export const metadata: Metadata = { title: "Contact Team" };

export default function PortalContactPage() {
  return <PortalContactScreen />;
}
