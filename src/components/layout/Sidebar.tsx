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

const navigation = [
  { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: "Properties", href: ROUTES.PROPERTIES, icon: Building2 },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Vehicle Alerts", href: "/vehicle-alerts", icon: BellRing },
  { name: "Jobs", href: ROUTES.JOBS, icon: Briefcase },
  {
    name: "Installed Systems",
    href: ROUTES.INSTALLED_SYSTEMS,
    icon: Cpu,
  },
  { name: "Daily Plans", href: ROUTES.DAILY_PLANS, icon: CalendarDays },
  { name: "Live Operations", href: ROUTES.LIVE_OPERATIONS, icon: Radio },
  { name: "Inventory", href: ROUTES.INVENTORY, icon: Package },
  { name: "Dispatch", href: ROUTES.DISPATCH, icon: Send },
  { name: "Company Brain", href: ROUTES.COMPANY_BRAIN, icon: Brain },
  { name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 },
  { name: "Settings", href: ROUTES.SETTINGS, icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_0_30px_rgba(239,68,68,0.12)] ring-1 ring-white/10">
            <Image
              src="/logo.png"
              alt="Loop logo"
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              priority
            />
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
                    ? "bg-gradient-to-r from-red-600/20 via-blue-500/10 to-transparent text-white ring-1 ring-red-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute bottom-2 left-0 top-2 w-1 rounded-r-full transition-all",
                    isActive
                      ? "bg-gradient-to-b from-red-500 to-blue-500 shadow-[0_0_16px_rgba(239,68,68,0.65)]"
                      : "bg-transparent",
                  ].join(" ")}
                />

                <div
                  className={[
                    "relative flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    isActive
                      ? "bg-white/10 text-white ring-1 ring-white/10"
                      : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white",
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

      <div className="border-t border-slate-800 px-5 py-4">
        <div className="rounded-2xl bg-gradient-to-br from-red-600/15 via-slate-900 to-blue-600/10 p-4 ring-1 ring-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Climate Control Ops
          </p>
          <p className="mt-2 text-sm font-medium text-white">
            Heating. Cooling. Field execution.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Coordinate customers, properties, jobs, and fleet alerts in one operating system.
          </p>
        </div>
      </div>
    </aside>
  );
}
