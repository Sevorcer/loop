import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AppearancePreferencesEffect } from "@/features/settings/components/AppearancePreferencesEffect";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const APP_ICON = "/logo.png";

export const metadata: Metadata = {
  title: {
    default: "LOOP — Field Operations Platform",
    template: "%s | LOOP",
  },
  description:
    "LOOP is the operating system for field service companies — jobs, dispatch, properties, inventory, and more.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LOOP",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: APP_ICON,
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3b82f6",
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
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
