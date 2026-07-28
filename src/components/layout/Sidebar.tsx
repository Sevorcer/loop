"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pin, PinOff } from "lucide-react";

import { useSession, getNavItemsForRole } from "@/features/auth";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { UserDisplay } from "@/features/auth/components/UserDisplay";
import { SHELL_NAV_GROUPS } from "./sidebarNav";

const NAV_SKELETON_ROWS = SHELL_NAV_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

interface SidebarProps {
  id?: string;
  className?: string;
  onNavigate?: () => void;
  /** Whether the sidebar is currently pinned (desktop only). */
  isPinned?: boolean;
  /** Called when the user toggles the pin. Omit to hide the pin button (e.g. mobile). */
  onPinToggle?: () => void;
}

export default function Sidebar({ id, className, onNavigate, isPinned = false, onPinToggle }: SidebarProps) {
  const pathname = usePathname();
  const { role, loading } = useSession();

  const filteredGroups = getNavItemsForRole(role, SHELL_NAV_GROUPS);
  const shouldBypassRoleFilter = !loading && role !== "portal" && filteredGroups.length === 0;
  const visibleGroups = shouldBypassRoleFilter ? SHELL_NAV_GROUPS : filteredGroups;

  return (
    <aside
      id={id}
      className={cn(
        "flex h-full w-full flex-col border-r border-slate-800 bg-slate-950 text-slate-100",
        className
      )}
    >
      <div className="border-b border-slate-800 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between gap-3">
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

          {onPinToggle && (
            <button
              type="button"
              onClick={onPinToggle}
              aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
              aria-pressed={isPinned}
              className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-5" aria-busy={loading} aria-label="Main navigation">
          {loading ? (
            <div className="space-y-1 px-3" aria-hidden="true">
              {Array.from({ length: NAV_SKELETON_ROWS }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">
              No navigation items available.
            </div>
          ) : (
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
              </div>
            ))
          )}
        </nav>
      </div>

      <div className="border-t border-slate-800 px-1 py-2">
        <UserDisplay />
        <SignOutButton />
      </div>
    </aside>
  );
}