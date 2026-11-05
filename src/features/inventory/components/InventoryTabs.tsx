"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { activeInventoryTab, INVENTORY_TABS } from "../utils/inventoryTabs";

/** Section navigation rendered under PageHeader on every inventory screen. */
export function InventoryTabs() {
  const pathname = usePathname();
  const active = activeInventoryTab(pathname);

  return (
    <nav aria-label="Inventory sections" className="overflow-x-auto">
      <ul className="flex min-w-max gap-2 max-md:min-w-0 max-md:flex-wrap">
        {INVENTORY_TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                  isActive
                    ? "status-info"
                    : "border-transparent text-muted hover:bg-surface-elevated hover:text-primary",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
