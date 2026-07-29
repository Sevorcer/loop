import type { Metadata } from "next";
import "./globals.css";

import { AppearancePreferencesEffect } from "@/features/settings/components/AppearancePreferencesEffect";

const APP_ICON = "/logo.png";

export const metadata: Metadata = {
  title: {
    default: "LOOP — Field Operations Platform",
    template: "%s | LOOP",
  },
  description:
    "LOOP is the operating system for field service companies — jobs, dispatch, properties, inventory, and more.",
  icons: {
    icon: APP_ICON,
    shortcut: APP_ICON,
    apple: APP_ICON,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppearancePreferencesEffect />
        {children}
      </body>
    </html>
  );
}
