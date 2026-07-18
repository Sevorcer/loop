"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  CalendarDays,
  Brain,
  Settings,
  BellRing,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Customers", href: "/customers", icon: Building2 },
  { name: "Vehicle Alerts", href: "/vehicle-alerts", icon: BellRing },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Daily Plans", href: "/daily-plans", icon: CalendarDays },
  { name: "Company Brain", href: "/company-brain", icon: Brain },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900">LOOP</h1>
        <p className="text-sm text-slate-500">Field Operations Platform</p>
      </div>

      <nav className="p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={[
                "mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition",
                isActive
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}