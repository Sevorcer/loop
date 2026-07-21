"use client";

/**
 * Administration sidebar navigation — Sprint 30 IA refactor.
 *
 * Dedicated sidebar for the /admin area. Scoped to governance/configuration
 * modules only. Operational entities (Jobs, Customers, Properties) live in
 * the Operations shell at their own routes.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building, ShieldCheck, ArrowLeft } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { UserDisplay } from "@/features/auth/components/UserDisplay";
import {
  ADMIN_AREA_LABEL,
  ADMIN_NAV_ITEMS,
  type AdminNavItem,
} from "../config/adminNavItems";

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Organizations: Building,
};

type NavItemWithIcon = AdminNavItem & {
  icon: React.ComponentType<{ size?: number }>;
};

const adminNavItemsWithIcons: NavItemWithIcon[] = ADMIN_NAV_ITEMS.map((item) => ({
  ...item,
  icon: NAV_ICONS[item.name] ?? Building,
}));

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/20 ring-1 ring-red-500/30">
            <ShieldCheck size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">{ADMIN_AREA_LABEL}</h1>
            <p className="text-xs text-slate-400">Governance &amp; configuration</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="Administration navigation">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Governance
          </p>
          <div className="space-y-0.5">
            {adminNavItemsWithIcons.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-gradient-to-r from-red-600/20 via-blue-500/10 to-transparent text-white ring-1 ring-red-500/30"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full transition-all",
                      isActive
                        ? "bg-gradient-to-b from-red-500 to-blue-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                        : "bg-transparent"
                    )}
                  />
                  <div
                    className={cn(
                      "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all",
                      isActive
                        ? "bg-white/10 text-white ring-1 ring-white/10"
                        : "text-slate-400 group-hover:text-slate-200"
                    )}
                  >
                    <Icon size={15} />
                  </div>
                  <span className="relative z-10 truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-1 border-t border-slate-800 px-3 py-3">
        <Link
          href={ROUTES.DASHBOARD}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          <ArrowLeft size={14} />
          <span>Back to Operations</span>
        </Link>
        <UserDisplay />
        <SignOutButton />
      </div>
    </aside>
  );
}
