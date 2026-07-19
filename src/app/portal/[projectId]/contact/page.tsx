import type { Metadata } from "next";

import { ContactTeamScreen } from "@/features/project-portal/screens/ContactTeamScreen";

export const metadata: Metadata = { title: "Contact Team" };

export default function ContactPage() {
  return <ContactTeamScreen />;
}
