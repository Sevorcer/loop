"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  CalendarDays,
  Brain,
  Settings,
  BellRing,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Vehicle Alerts", href: "/vehicle-alerts", icon: BellRing },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Daily Plans", href: "/daily-plans", icon: CalendarDays },
  { name: "Company Brain", href: "/company-brain", icon: Brain },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-white/10 bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600/15 ring-1 ring-red-500/30">
            <div className="h-5 w-5 rounded-full bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.55)]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              LOOP
            </h1>
            <p className="text-sm text-slate-400">Field Operations Platform</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Operations
        </div>

        <nav className="space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={[
                  "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-red-600/20 via-red-500/10 to-transparent text-white ring-1 ring-red-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all",
                    isActive ? "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.75)]" : "bg-transparent",
                  ].join(" ")}
                />

                <div
                  className={[
                    "relative flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    isActive
                      ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/25"
                      : "bg-white/5 text-slate-400 group-hover:bg-red-500/10 group-hover:text-red-300",
                  ].join(" ")}
                >
                  <Icon size={18} />
                </div>

                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="rounded-2xl bg-gradient-to-br from-red-600/15 via-slate-900 to-slate-900 p-4 ring-1 ring-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
            Fleet Watch
          </p>
          <p className="mt-2 text-sm font-medium text-white">
            Keep field teams moving.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Monitor properties, customers, jobs, and vehicle issues from one place.
          </p>
        </div>
      </div>
    </aside>
  );
}