"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Command, Menu, Search } from "lucide-react";

import { UniversalCommandBar } from "@/features/command-bar";
import { FeedbackButton } from "@/features/feedback";
import { useAppearancePreferences } from "@/features/settings/hooks/useAppearancePreferences";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeSidebarLayout, readSidebarPinned, writeSidebarPinned } from "./sidebarState";

import Sidebar from "./Sidebar";
import Header from "./Header";

// Width of the left-edge hot zone strip that triggers the sidebar hover.
// 1rem (w-4) is wide enough to be easily hovered but narrow enough not to
// interfere with main content which has lg:px-8 padding.
const HOT_ZONE_CLASS = "w-4" as const;

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

  // Desktop sidebar state — initialized synchronously from localStorage to
  // avoid a visible layout shift on first paint.
  const [isPinned, setIsPinned] = useState<boolean>(() => readSidebarPinned());
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const { preferences } = useAppearancePreferences();

  const desktopSidebarRef = useRef<HTMLDivElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);

  // When keyboard-opened, move focus into the sidebar so the user can Tab
  // through nav items immediately.
  useEffect(() => {
    if (!isKeyboardOpen || !desktopSidebarRef.current) return;
    const firstFocusable = desktopSidebarRef.current.querySelector<HTMLElement>(
      "a[href], button:not([disabled])"
    );
    firstFocusable?.focus();
  }, [isKeyboardOpen]);

  // ESC → close mobile nav
  useEffect(() => {
    if (!isMobileNavOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  // ESC → close keyboard-opened desktop sidebar (when not pinned)
  useEffect(() => {
    if (!isKeyboardOpen || isPinned) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsKeyboardOpen(false);
        desktopTriggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isKeyboardOpen, isPinned]);

  function handlePinToggle() {
    const next = !isPinned;
    setIsPinned(next);
    writeSidebarPinned(next);
    if (!next) setIsKeyboardOpen(false);
  }

  const layout = computeSidebarLayout({ isPinned, isKeyboardOpen });

  return (
    <div className="flex min-h-dvh bg-slate-950 text-slate-100">

      {/* ── Desktop sidebar spacer ──────────────────────────────────────────
          Only rendered when pinned. Shifts the main content column to the
          right so it doesn't sit under the fixed sidebar panel.           */}
      {layout.reservesLayoutSpace && (
        <div className="hidden w-64 shrink-0 lg:block" aria-hidden="true" />
      )}

      {/* ── Desktop adaptive sidebar ────────────────────────────────────────
          The outer wrapper is the CSS hover group. It is a 16 px hot zone
          fixed to the left edge. The sidebar panel is absolutely positioned
          inside it and extends beyond the wrapper's width — CSS :hover on
          a parent still fires when the cursor is over an absolutely-placed
          child, so hovering the sidebar keeps the group active.           */}
      <div
        className={cn(
          "group/sidebar",
          "fixed inset-y-0 left-0 z-50",
          "hidden lg:block",
          HOT_ZONE_CLASS // hot-zone width; sidebar extends beyond via absolute positioning
        )}
      >
        {/* Sidebar panel */}
        <div
          ref={desktopSidebarRef}
          id="desktop-navigation"
          className={cn(
            "absolute inset-y-0 left-0 w-64",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            layout.isOpen
              ? "translate-x-0 shadow-none"
              : cn(
                  "-translate-x-[calc(100%-1rem)]",
                  "group-hover/sidebar:translate-x-0",
                  "shadow-2xl shadow-black/60"
                )
          )}
        >
          <Sidebar
            isPinned={isPinned}
            onPinToggle={handlePinToggle}
            onNavigate={() => setIsKeyboardOpen(false)}
            navOverride={preferences.sidebarNavOverride}
          />
        </div>

        {/* Keyboard trigger button — sits in the visible 16 px strip.
            Keyboard users Tab to it; Enter/Space toggles the sidebar open.
            Hidden visually until the hot zone is hovered or it receives focus,
            so it doesn't clutter the edge when no one is interacting.     */}
        {!isPinned && (
          <button
            ref={desktopTriggerRef}
            type="button"
            aria-label={isKeyboardOpen ? "Close navigation sidebar" : "Open navigation sidebar"}
            aria-expanded={isKeyboardOpen}
            aria-controls="desktop-navigation"
            onClick={() => setIsKeyboardOpen((open) => !open)}
            className={cn(
              "absolute left-0.5 top-4 z-10",
              "flex h-7 w-7 items-center justify-center rounded",
              "text-slate-600 transition-all",
              // Visible on group hover or when focused/keyboard-open
              "opacity-0 group-hover/sidebar:opacity-100",
              "hover:bg-white/5 hover:text-slate-300",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50",
              isKeyboardOpen && "opacity-100"
            )}
          >
            <Menu size={14} />
          </button>
        )}
      </div>
      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="relative flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-red-600/10 blur-3xl" />
          <div className="absolute right-[-140px] top-[120px] h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute bottom-[-160px] left-[25%] h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <Header
          isMobileNavOpen={isMobileNavOpen}
          onMenuToggle={() => setIsMobileNavOpen((open) => !open)}
          onOpenCommandBar={() => setIsCommandBarOpen(true)}
        />

        <main className="relative z-10 flex-1">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 safe-area-content">
            {children}
          </div>
        </main>
      </div>

      <UniversalCommandBar
        open={isCommandBarOpen}
        onOpenChange={setIsCommandBarOpen}
      />

      {/* Floating Actions Stack — vertical column, bottom-right corner.
          Lifts above any sticky mobile action bar via the body flag. */}
      <div
        className="floating-actions-stack fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-3 lg:bottom-8 lg:right-8"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Report Feedback */}
        <FeedbackButton />

        {/* Ask Copilot — desktop */}
        <div className="group relative hidden sm:block">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setIsCommandBarOpen(true)}
            aria-label="Open command bar"
            className="h-10 w-10 rounded-full border border-white/15 bg-slate-900/90 text-slate-200 shadow-xl hover:bg-slate-800"
          >
            <Command className="h-4 w-4" />
          </Button>
          <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            Ask Copilot
          </span>
        </div>

        {/* Ask Copilot — mobile */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => setIsCommandBarOpen(true)}
          aria-label="Open command bar"
          className="h-12 w-12 rounded-full border border-white/15 bg-slate-900/95 text-slate-100 shadow-xl sm:hidden"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Mobile backdrop ─────────────────────────────────────────────── */}
      {isMobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      ) : null}

      {/* ── Mobile sidebar drawer ───────────────────────────────────────── */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-[70] w-72 max-w-[calc(100vw-3rem)] transition-transform duration-200 lg:hidden safe-area-drawer",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Sidebar
          id="mobile-navigation"
          onNavigate={() => setIsMobileNavOpen(false)}
          navOverride={preferences.sidebarNavOverride}
          // Pin control is desktop-only; omit onPinToggle to hide the button.
        />
      </div>

    </div>
  );
}
