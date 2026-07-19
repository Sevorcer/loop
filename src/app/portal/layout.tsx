import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Project Portal",
    template: "%s | LOOP Portal",
  },
  description: "Secure project progress portal for customers and partners.",
};

export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
