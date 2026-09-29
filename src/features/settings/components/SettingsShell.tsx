"use client";

/**
 * SettingsShell — two-column layout for the /settings area.
 *
 * Renders a fixed settings sidebar alongside the page content within
 * the existing AppShell. Provides responsive mobile drawer for the
 * settings sub-navigation.
 */

import { type ReactNode, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsSidebar } from "./SettingsSidebar";

interface SettingsShellProps {
  children: ReactNode;
}

/** True only on the client after hydration — safe gate for createPortal. */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function SettingsShell({ children }: SettingsShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isClient = useIsClient();

  // The mobile drawer + overlay are portaled to document.body so they escape
  // the <main> stacking context (relative z-10). Without the portal, the
  // sticky app header (z-30, a sibling of <main>) paints above the entire
  // main element, covering the drawer's top links.
  const mobileNav =
    isClient
      ? createPortal(
          <>
            {isMobileNavOpen ? (
              <button
                type="button"
                aria-label="Close settings navigation"
                className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
                onClick={() => setIsMobileNavOpen(false)}
              />
            ) : null}
            <div
              className={[
                "fixed inset-y-0 left-0 z-50 w-72 max-w-[calc(100vw-3rem)] border-r border-slate-800 bg-slate-950 px-4 py-6 transition-transform duration-200 lg:hidden",
                isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
              ].join(" ")}
            >
              <SettingsSidebar onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="flex min-h-0 gap-6">
      {/* Desktop sidebar */}
      <div className="hidden w-56 shrink-0 lg:block xl:w-64">
        <SettingsSidebar />
      </div>

      {mobileNav}

      {/* Main content area */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Mobile nav toggle */}
        <div className="flex items-center gap-3 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open settings navigation"
            onClick={() => setIsMobileNavOpen(true)}
            className="h-8 w-8 shrink-0"
          >
            <PanelLeft size={16} />
          </Button>
          <span className="text-sm text-slate-400">Settings</span>
        </div>

        {children}
      </div>
    </div>
  );
}
