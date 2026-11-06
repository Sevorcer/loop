"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ROUTE_ROLES, useCurrentRole } from "@/features/auth";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Overview / Live tabs at the top of Operations (2026-11-05). Each tab is its
 * own address so the Live view can be bookmarked on a shop screen. The Live
 * tab only shows for roles allowed to open it (owner, manager, dispatch,
 * office); the proxy enforces the same rule on the address itself.
 */
export function OperationsTabs() {
  const pathname = usePathname();
  const { role } = useCurrentRole();
  const liveRoles = NAV_ROUTE_ROLES[ROUTES.OPERATIONS_LIVE] ?? [];
  const showLive = role !== null && liveRoles.includes(role);

  const tabs = [
    { href: ROUTES.OPERATIONS, label: "Overview" },
    ...(showLive ? [{ href: ROUTES.OPERATIONS_LIVE, label: "Live" }] : []),
  ];

  if (tabs.length < 2) return null;

  return (
    <nav aria-label="Operations views" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              active
                ? "border-blue-500/40 bg-blue-500/15 text-white"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white",
            )}
          >
            {tab.label === "Live" ? (
              <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
            ) : null}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
