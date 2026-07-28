"use client";

/**
 * SettingsSidebar — inner navigation for the /settings area.
 *
 * Rendered inside the main AppShell as a secondary nav panel.
 * Scoped to Settings sections only.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Shield, Palette } from "lucide-react";

import { cn } from "@/lib/utils";
import { SETTINGS_NAV_ITEMS, type SettingsNavItem } from "../config/settingsNavItems";

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Users,
  "Roles & Permissions": Shield,
  Appearance: Palette,
};

type SettingsNavItemWithIcon = SettingsNavItem & {
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const navItemsWithIcons: SettingsNavItemWithIcon[] = SETTINGS_NAV_ITEMS.map((item) => ({
  ...item,
  icon: NAV_ICONS[item.name] ?? Shield,
}));

interface SettingsSidebarProps {
  onNavigate?: () => void;
}

export function SettingsSidebar({ onNavigate }: SettingsSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col">
      <nav aria-label="Settings navigation">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Settings
        </p>
        <div className="space-y-0.5">
          {navItemsWithIcons.map((item) => {
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
                    ? "bg-blue-500/10 text-white ring-1 ring-blue-500/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <span
                  className={cn(
                    "absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full transition-all",
                    isActive
                      ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                      : "bg-transparent"
                  )}
                />
                <div
                  className={cn(
                    "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all",
                    isActive
                      ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20"
                      : "text-slate-400 group-hover:text-slate-200"
                  )}
                >
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="relative z-10 truncate">{item.name}</p>
                  <p className="truncate text-[10px] text-slate-500 group-hover:text-slate-400">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
