"use client";

/**
 * OperationsNavBar — secondary horizontal navigation for the Operations section.
 *
 * Renders a tab-style nav bar linking between the four operational phases:
 * Operations Home, Morning Operations, Live Operations, and Dispatch.
 *
 * Designed to be embedded in the layout or header area of any Operations page.
 */

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { useCurrentRole } from "@/features/auth";
import { NAV_ROUTE_ROLES } from "@/features/auth/utils/navPermissions";
import { OPERATIONS_NAV_ITEMS } from "../config/operationsNav";

export function OperationsNavBar() {
  const pathname = usePathname();
  const { role } = useCurrentRole();

  const visibleItems = useMemo(() => {
    if (!role) return OPERATIONS_NAV_ITEMS;
    return OPERATIONS_NAV_ITEMS.filter((item) => {
      const allowed = NAV_ROUTE_ROLES[item.href];
      if (!allowed) return true;
      return allowed.includes(role);
    });
  }, [role]);

  return (
    <nav
      aria-label="Operations navigation"
      className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-default bg-surface px-2 py-1.5 scrollbar-none"
    >
      {visibleItems.map((item) => {
        const isActive =
          item.href === ROUTES.OPERATIONS
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 whitespace-nowrap",
              isActive
                ? "bg-accent-soft text-white border border-accent-soft"
                : "text-muted hover:bg-surface-elevated hover:text-accent"
            )}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent"
              />
            )}
            <span className="hidden sm:inline">{item.name}</span>
            <span className="sm:hidden">{item.shortName}</span>
          </Link>
        );
      })}
    </nav>
  );
}
