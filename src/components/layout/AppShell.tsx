"use client";

import { type ReactNode, useEffect, useState } from "react";

import Sidebar from "./Sidebar";
import Header from "./Header";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <div className="hidden h-screen w-64 shrink-0 lg:block">
        <Sidebar />
      </div>

      {isMobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      ) : null}

      <div
        className={[
          "fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-1.5rem))] max-w-full transition-transform duration-200 lg:hidden",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Sidebar id="mobile-navigation" onNavigate={() => setIsMobileNavOpen(false)} />
      </div>

      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-red-600/10 blur-3xl" />
          <div className="absolute right-[-140px] top-[120px] h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute bottom-[-160px] left-[25%] h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <Header
          isMobileNavOpen={isMobileNavOpen}
          onMenuToggle={() => setIsMobileNavOpen((open) => !open)}
        />

        <main className="relative z-10 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}