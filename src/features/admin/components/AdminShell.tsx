"use client";

/**
 * AdminShell — layout chrome for the /admin area.
 *
 * Mirrors the structure of AppShell but uses AdminSidebar instead of the
 * operations Sidebar. Provides responsive mobile drawer nav.
 */

import { type ReactNode, useEffect, useState } from "react";

import { AdminSidebar } from "./AdminSidebar";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  return (
    <div className="flex min-h-dvh bg-slate-950 text-slate-100">
      {/* Desktop sidebar */}
      <div className="hidden h-screen w-64 shrink-0 lg:block">
        <AdminSidebar />
      </div>

      {/* Mobile overlay */}
      {isMobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      ) : null}

      {/* Mobile drawer */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[calc(100vw-3rem)] transition-transform duration-200 lg:hidden safe-area-drawer",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <AdminSidebar onNavigate={() => setIsMobileNavOpen(false)} />
      </div>

      {/* Main content */}
      <div className="relative flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden bg-slate-950">
        {/* Mobile header bar */}
        <div className="flex items-center border-b border-slate-800 px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="mr-3 rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            onClick={() => setIsMobileNavOpen(true)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="text-sm font-medium text-slate-300">Administration</span>
        </div>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 safe-area-content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
