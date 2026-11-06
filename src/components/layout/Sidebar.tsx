"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import type { ComponentType } from "react";

import { useSession } from "@/features/auth";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { UserDisplay } from "@/features/auth/components/UserDisplay";
import { PHONE_NAV_ACTIONS_VISIBILITY_CLASS } from "./floatingActions";
import { composeSidebarNav, composeTopLevelNav, isJobDetailPath, SHELL_NAV_GROUPS, SHELL_TOP_LEVEL_ITEMS } from "./sidebarNav";

const NAV_SKELETON_ROWS =
  SHELL_TOP_LEVEL_ITEMS.length + SHELL_NAV_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

export interface SidebarPhoneAction {
  label: string;
  icon: ComponentType<{ size?: number }>;
  onSelect: () => void;
  /** Existing keyboard shortcut, announced to assistive tech. */
  keyShortcuts?: string;
}

interface SidebarProps {
  id?: string;
  className?: string;
  onNavigate?: () => void;
  /** Whether the sidebar is currently pinned (desktop only). */
  isPinned?: boolean;
  /** Called when the user toggles the pin. Omit to hide the pin button (e.g. mobile). */
  onPinToggle?: () => void;
  navOverride?: readonly string[];
  /**
   * Phone-only actions pinned above the account block. Hidden from tablet
   * widths up. Omit on the desktop sidebar.
   */
  phoneActions?: readonly SidebarPhoneAction[];
}

export default function Sidebar({
  id,
  className,
  onNavigate,
  isPinned = false,
  onPinToggle,
  navOverride,
  phoneActions,
}: SidebarProps) {
  const pathname = usePathname();
  const { role, loading } = useSession();
  // From a job detail route, soft navigation never commits (see
  // isJobDetailPath) — sidebar links hard-navigate there instead.
  const hardNav = isJobDetailPath(pathname);

  const visibleGroups = composeSidebarNav({
    role,
    navOverride,
  });
  const topLevelItems = composeTopLevelNav(role);
  // Top-level entries render first, as a heading-less block above the groups.
  const renderedGroups = topLevelItems.length > 0 && visibleGroups.length > 0
    ? [{ label: "", items: topLevelItems }, ...visibleGroups]
    : visibleGroups;

  return (
    <aside
      id={id}
      className={cn(
        "flex h-full w-full flex-col border-r border-default bg-background text-foreground",
        className
      )}
    >
      <div className="border-b border-default px-4 py-4 sm:px-5 sm:py-5">
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
              className="hidden shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 lg:inline-flex"
            >
              {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
        </div>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col"
        aria-busy={loading}
        aria-label="Main navigation"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
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
              renderedGroups.map((group) => (
                <div key={group.label || "top-level"}>
                  {group.label ? (
                    <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {group.label}
                    </p>
                  ) : null}

                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        pathname === item.href ||
                        (item.href !== ROUTES.DASHBOARD &&
                          pathname.startsWith(`${item.href}/`));
                      const linkClassName = cn(
                        "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-accent-soft border border-accent-soft text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      );
                      const linkContent = (
                        <>
                          <span
                            className={cn(
                              "absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full transition-all",
                              isActive
                                ? "bg-accent shadow-accent-glow"
                                : "bg-transparent"
                            )}
                          />

                          <div
                            className={cn(
                              "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all",
                              isActive
                                ? "bg-accent-strong text-accent border border-accent-soft"
                                : "text-slate-400 group-hover:text-slate-200"
                            )}
                          >
                            <Icon size={15} />
                          </div>

                          <span className="relative z-10 truncate">{item.name}</span>
                        </>
                      );

                      // Hard navigation from job detail routes: soft nav out
                      // of /jobs/[id] never commits, which left these tabs
                      // dead (same bug as PRs #324/#326 in JobDetailScreen).
                      return hardNav ? (
                        // eslint-disable-next-line @next/next/no-html-link-for-pages -- hard-navigation required: soft-nav out of job detail never commits
                        <a
                          key={item.name}
                          href={item.href}
                          onClick={onNavigate}
                          className={linkClassName}
                        >
                          {linkContent}
                        </a>
                      ) : (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={onNavigate}
                          className={linkClassName}
                        >
                          {linkContent}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {phoneActions && phoneActions.length > 0 ? (
          <div
            className={cn(
              "border-t border-default px-3 py-2",
              PHONE_NAV_ACTIONS_VISIBILITY_CLASS,
            )}
          >
            <div className="space-y-0.5">
              {phoneActions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onSelect}
                    aria-keyshortcuts={action.keyShortcuts}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-400 transition-all duration-150 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 group-hover:text-slate-200">
                      <Icon size={15} />
                    </div>
                    <span className="truncate">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-default px-1 py-2">
        <UserDisplay />
        <SignOutButton />
      </div>
    </aside>
  );
}
