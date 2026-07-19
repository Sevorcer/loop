"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  Cpu,
  CalendarDays,
  Radio,
  Package,
  Brain,
  BarChart3,
  Settings,
  BellRing,
  Send,
} from "lucide-react";

import { ROUTES } from "@/lib/routes";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
    ],
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
      { name: "Customers", href: "/customers", icon: Users },
      { name: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, icon: Cpu },
      { name: "Vehicle Alerts", href: "/vehicle-alerts", icon: BellRing },
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
    items: [
      { name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Settings", href: ROUTES.SETTINGS, icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
      {/* Logo */}
      <div className="border-b border-slate-800 px-5 py-5">
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
            <h1 className="text-xl font-semibold tracking-tight text-white">
              LOOP
            </h1>
            <p className="text-xs text-slate-400">Field Operations</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-5">
          {navGroups.map((group) => (
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
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 px-4 py-3">
        <p className="text-[11px] leading-5 text-slate-500">
          Climate Control Ops · HVAC Field Execution
        </p>
      </div>
    </aside>
  );
}
