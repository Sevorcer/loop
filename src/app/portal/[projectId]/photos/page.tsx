import type { Metadata } from "next";
import { PortalPhotosScreen } from "@/features/project-portal/screens/PortalPhotosScreen";

export const metadata: Metadata = { title: "Photos" };

export default function PortalPhotosPage() {
  return <PortalPhotosScreen />;
}
