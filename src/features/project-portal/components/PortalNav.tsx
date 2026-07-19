"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PORTAL_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface PortalNavProps {
  projectId: string;
  canViewTimeline: boolean;
  canViewDocuments: boolean;
}

interface NavTab {
  label: string;
  href: string;
  enabled: boolean;
}

/**
 * Tab navigation bar for the portal project screens.
 * Tabs are conditionally enabled based on the user's resolved permission set.
 */
export function PortalNav({
  projectId,
  canViewTimeline,
  canViewDocuments,
}: PortalNavProps) {
  const pathname = usePathname();

  const tabs: NavTab[] = [
    {
      label: "Overview",
      href: PORTAL_ROUTES.OVERVIEW(projectId),
      enabled: true,
    },
    {
      label: "Timeline",
      href: PORTAL_ROUTES.TIMELINE(projectId),
      enabled: canViewTimeline,
    },
    {
      label: "Documents",
      href: PORTAL_ROUTES.DOCUMENTS(projectId),
      enabled: canViewDocuments,
    },
    {
      label: "Contact Team",
      href: PORTAL_ROUTES.CONTACT(projectId),
      enabled: true,
    },
  ];

  return (
    <nav
      aria-label="Project portal sections"
      className="flex gap-1 overflow-x-auto border-b border-border pb-0"
    >
      {tabs.map((tab) => {
        if (!tab.enabled) return null;
        const isActive = pathname === tab.href || pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t-full after:bg-primary after:content-['']"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
