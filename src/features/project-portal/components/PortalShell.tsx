"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Image as ImageIcon, Bell, FileText, Users, LayoutDashboard, Home } from "lucide-react";
import type { ReactNode } from "react";

import type { PortalPermissions } from "../types/portalTypes";
import { usePortal } from "../state/PortalProvider";
import { StaleBanner } from "./StaleBanner";
import { PortalErrorDisplay, PortalLoadingState } from "./PortalErrorState";
import { getErrorState } from "../utils/portalAuth";
import { formatLastSynced } from "../utils/freshnessUtils";
import { PORTAL_ROUTES } from "@/lib/routes";

// ─── Navigation Items ─────────────────────────────────────────────────────────

interface NavTab {
  name: string;
  href: (projectId: string) => string;
  icon: React.ComponentType<{ size?: number }>;
  requiresPermission: keyof PortalPermissions | null;
}

const NAV_TABS: NavTab[] = [
  {
    name: "Overview",
    href: (id) => PORTAL_ROUTES.PROJECT(id),
    icon: LayoutDashboard,
    requiresPermission: null,
  },
  {
    name: "Timeline",
    href: (id) => PORTAL_ROUTES.TIMELINE(id),
    icon: Building2,
    requiresPermission: "canViewTimeline",
  },
  {
    name: "Documents",
    href: (id) => PORTAL_ROUTES.DOCUMENTS(id),
    icon: FileText,
    requiresPermission: "canViewDocuments",
  },
  {
    name: "Photos",
    href: (id) => PORTAL_ROUTES.PHOTOS(id),
    icon: ImageIcon,
    requiresPermission: "canViewPhotos",
  },
  {
    name: "Contact",
    href: (id) => PORTAL_ROUTES.CONTACT(id),
    icon: Users,
    requiresPermission: "canViewContact",
  },
  {
    name: "Notifications",
    href: (id) => PORTAL_ROUTES.NOTIFICATIONS(id),
    icon: Bell,
    requiresPermission: null,
  },
];

// ─── Shell ────────────────────────────────────────────────────────────────────

interface PortalShellProps {
  children: ReactNode;
}

/**
 * PortalShell provides the portal-specific layout chrome:
 * - Top bar with project name and last-sync display
 * - Tab navigation (role-filtered)
 * - Stale banner
 * - Error state interception (replaces content with full-screen error)
 */
export function PortalShell({ children }: PortalShellProps) {
  const { authz, project, permissions, freshness, currentProjectId } = usePortal();
  const pathname = usePathname();

  // ── Loading state ────────────────────────────────────────────────────────
  if (currentProjectId && authz === null) {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
        <PortalTopBar />
        <PortalLoadingState />
      </div>
    );
  }

  // ── Authorization error ───────────────────────────────────────────────────
  if (authz && !authz.granted && authz.errorCode) {
    const errorState = getErrorState(authz.errorCode);
    return (
      <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
        <PortalTopBar />
        <PortalErrorDisplay error={errorState} />
      </div>
    );
  }

  // ── Resolved nav tabs filtered by permissions ──────────────────────────────
  const visibleTabs = NAV_TABS.filter((tab) => {
    if (!tab.requiresPermission) return true;
    return permissions?.[tab.requiresPermission] === true;
  });

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      {/* Top bar */}
      <PortalTopBar project={project} freshness={freshness} />

      {/* Stale banner */}
      <StaleBanner freshness={freshness} />

      {/* Tab navigation */}
      {currentProjectId && (
        <nav
          aria-label="Project sections"
          className="border-b border-slate-800 bg-slate-950 px-4 sm:px-6"
        >
          <div className="mx-auto max-w-4xl">
            <div
              className="flex gap-1 overflow-x-auto scrollbar-none"
              role="tablist"
            >
              {visibleTabs.map((tab) => {
                const href = tab.href(currentProjectId);
                const isExact = href === pathname || pathname === href;
                const isActive =
                  isExact ||
                  (href !== PORTAL_ROUTES.PROJECT(currentProjectId) &&
                    pathname.startsWith(href));
                const Icon = tab.icon;

                return (
                  <Link
                    key={tab.name}
                    href={href}
                    role="tab"
                    aria-selected={isActive}
                    className={[
                      "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 min-h-[44px]",
                      isActive
                        ? "border-blue-500 text-white"
                        : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200",
                    ].join(" ")}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{tab.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

interface PortalTopBarProps {
  project?: { name: string; lastSyncedAt: string } | null;
  freshness?: { lastSyncedAt: string };
}

function PortalTopBar({ project, freshness }: PortalTopBarProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        {/* Brand + project name */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/portal"
            aria-label="Return to portal home"
            className="flex items-center gap-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
          >
            <Home size={16} aria-hidden="true" className="shrink-0 text-blue-400" />
            <span className="text-sm font-semibold tracking-tight">LOOP Portal</span>
          </Link>
          {project ? (
            <>
              <span className="text-slate-700" aria-hidden="true">/</span>
              <span className="truncate text-sm text-slate-300">{project.name}</span>
            </>
          ) : null}
        </div>

        {/* Last sync */}
        {freshness && (
          <p className="shrink-0 text-xs text-slate-500">
            Synced {formatLastSynced(freshness.lastSyncedAt)}
          </p>
        )}
      </div>
    </header>
  );
}
