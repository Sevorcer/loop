"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  HardHat,
  Cpu,
  CalendarDays,
  Radio,
  Package,
  Brain,
  BarChart3,
  Settings,
  BellRing,
  Send,
  Globe,
} from "lucide-react";

import { useSession, getNavItemsForRole } from "@/features/auth";
import type { NavGroup } from "@/features/auth";
import { ROUTES, PORTAL_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { UserDisplay } from "@/features/auth/components/UserDisplay";

/**
 * Avoid permanent "blank sidebar" when role/session resolution is slow:
 * - Show skeleton briefly while loading.
 * - Then fall back to a conservative role so navigation still renders.
 */
const LOADING_FALLBACK_MS = 1500;

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { name: "Daily Plans", href: ROUTES.DAILY_PLANS, icon: CalendarDays },
      { name: "Live Operations", href: ROUTES.LIVE_OPERATIONS, icon: Radio },
      { name: "Dispatch", href: ROUTES.DISPATCH, icon: Send },
    ],
  },
  {
    label: "Field",
    items: [
      { name: "Jobs", href: ROUTES.JOBS, icon: Briefcase },
      { name: "Properties", href: ROUTES.PROPERTIES, icon: Building2 },
      { name: "Contractors", href: ROUTES.CONTRACTORS, icon: HardHat },
      { name: "Customers", href: ROUTES.CUSTOMERS, icon: Users },
      { name: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, icon: Cpu },
      { name: "Vehicle Alerts", href: ROUTES.VEHICLE_ALERTS, icon: BellRing },
    ],
  },
  {
    label: "Resources",
    items: [
      { name: "Inventory", href: ROUTES.INVENTORY, icon: Package },
      { name: "Company Brain", href: ROUTES.COMPANY_BRAIN, icon: Brain },
    ],
  },
  {
    label: "Insights",
    items: [{ name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 }],
  },
  {
    label: "External",
    items: [{ name: "Project Portal", href: PORTAL_ROUTES.ROOT, icon: Globe }],
  },
  {
    label: "Workspace",
    items: [{ name: "Settings", href: ROUTES.SETTINGS, icon: Settings }],
  },
];

/** Total number of nav items across all groups — used to size the loading skeleton. */
const NAV_SKELETON_ROWS = navGroups.reduce((sum, g) => sum + g.items.length, 0);

interface SidebarProps {
  id?: string;
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ id, className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { role, loading } = useSession();

  // If loading takes too long, stop blocking nav render.
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoadingTimedOut(true);
    }, LOADING_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, [loading]);

  // Infer role type directly from useSession() so we don't need to import AppRole.
  // Use conservative fallback role string expected by your current role union.
  const resolvedRole: NonNullable<typeof role> = (role ?? "dispatch") as NonNullable<typeof role>;
  const visibleGroups = getNavItemsForRole(resolvedRole, navGroups);

  const showSkeleton = loading && !loadingTimedOut && visibleGroups.length === 0;

  return (
    <aside
      id={id}
      className={cn(
        "flex h-full w-full flex-col border-r border-slate-800 bg-slate-950 text-slate-100",
        className
      )}
    >
      {/* Logo */}
      <div className="border-b border-slate-800 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_0_30px_rgba(239,68,68,0.12)] ring-1 ring-white/10">
            <Image
              src="/logo.png"
              alt="Loop logo"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">LOOP</h1>
            <p className="text-xs text-slate-400">Field Operations</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-5" aria-busy={loading} aria-label="Main navigation">
          {showSkeleton ? (
            <div className="space-y-1 px-3" aria-hidden="true">
              {Array.from({ length: NAV_SKELETON_ROWS }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : visibleGroups.length > 0 ? (
            visibleGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {group.label}
                </p>

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== ROUTES.DASHBOARD &&
                        pathname.startsWith(`${item.href}/`));

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onNavigate}
                        className={[
                          "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-gradient-to-r from-red-600/20 via-blue-500/10 to-transparent text-white ring-1 ring-red-500/30"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full transition-all",
                            isActive
                              ? "bg-gradient-to-b from-red-500 to-blue-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                              : "bg-transparent",
                          ].join(" ")}
                        />

                        <div
                          className={[
                            "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all",
                            isActive
                              ? "bg-white/10 text-white ring-1 ring-white/10"
                              : "text-slate-400 group-hover:text-slate-200",
                          ].join(" ")}
                        >
                          <Icon size={15} />
                        </div>

                        <span className="relative z-10 truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3 text-xs text-slate-400">
              Navigation unavailable for current role.
            </div>
          )}
        </nav>
      </div>

      {/* Footer — user identity + sign out */}
      <div className="border-t border-slate-800 px-1 py-2">
        <UserDisplay />
        <SignOutButton />
      </div>
    </aside>
  );
}