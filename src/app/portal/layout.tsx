import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PORTAL_ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: {
    default: "Project Portal",
    template: "%s | LOOP Project Portal",
  },
  description: "Secure project visibility for customers, contractors, and builders.",
};

/**
 * Portal layout — external-facing chrome.
 *
 * Intentionally minimal: no sidebar, no internal navigation.
 * External stakeholders see only their project data.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Portal top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href={PORTAL_ROUTES.ROOT}
            className="flex items-center gap-2.5"
            aria-label="LOOP Project Portal home"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-white/10">
              <Image
                src="/logo.png"
                alt="LOOP"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Project Portal
            </span>
          </Link>

          <p className="hidden text-xs text-muted-foreground sm:block">
            Powered by LOOP
          </p>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      {/* Portal footer */}
      <footer className="border-t border-border px-4 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          This is a secure project portal. Data is read-only.
        </p>
      </footer>
    </div>
  );
}
