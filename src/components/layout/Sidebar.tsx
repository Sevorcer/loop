"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Briefcase,
  Building2,
  LayoutDashboard,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Vehicle Alerts", href: "/vehicle-alerts", icon: BellRing },
  { name: "Properties", href: "#", icon: Building2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="border-b border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-950">LOOP</h1>
        <p className="text-sm text-slate-500">Field Operations Platform</p>
      </div>

      <nav className="p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href !== "#" &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));

          return item.href === "#" ? (
            <div
              key={item.name}
              className="mb-2 flex items-center gap-3 rounded-lg px-4 py-3 text-slate-400"
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </div>
          ) : (
            <Link
              key={item.name}
              href={item.href}
              className={[
                "mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition",
                isActive
                  ? "bg-slate-900 text-white"
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
