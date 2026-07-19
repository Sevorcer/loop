"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, User } from "lucide-react";

const headerContent: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Monitor execution health across jobs and fleet activity.",
  },
  "/jobs": {
    title: "Jobs",
    subtitle: "Plan, update, and review field work without leaving the workflow.",
  },
  "/vehicle-alerts": {
    title: "Vehicle Alerts",
    subtitle: "Track field-reported fleet issues and follow-up status.",
  },
};

function getHeaderCopy(pathname: string) {
  if (pathname.startsWith("/jobs")) return headerContent["/jobs"];
  if (pathname.startsWith("/vehicle-alerts")) return headerContent["/vehicle-alerts"];
  return headerContent["/"];
}

export default function Header() {
  const pathname = usePathname();
  const copy = getHeaderCopy(pathname);

  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{copy.title}</h2>
        <p className="text-sm text-slate-500">{copy.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/jobs"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Jobs Board
        </Link>
        <button className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
          <Search size={20} />
        </button>
        <button className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
          <Bell size={20} />
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition hover:bg-slate-50">
          <User size={18} />
          <span className="text-sm font-medium">Collin</span>
        </button>
      </div>
    </header>
  );
}
