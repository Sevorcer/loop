"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, User, Sparkles, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const pageContent: Record<string, { title: string; description: string }> = {
  [ROUTES.DASHBOARD]: {
    title: "Dashboard",
    description: "Welcome back. Here's what's happening today.",
  },
  // Operations
  [ROUTES.DAILY_PLANS]: {
    title: "Daily Plans",
    description: "Coordinate schedules, technician priorities, and day-of execution.",
  },
  [ROUTES.LIVE_OPERATIONS]: {
    title: "Live Operations",
    description: "Monitor active jobs, crew status, and real-time field activity.",
  },
  [ROUTES.DISPATCH]: {
    title: "Dispatch",
    description: "Assign crews, schedule blocks, and coordinate same-day field deployments.",
  },
  // Field
  [ROUTES.JOBS]: {
    title: "Jobs",
    description: "Review upcoming work, assignments, and operational progress.",
  },
  [ROUTES.PROPERTIES]: {
    title: "Properties",
    description: "Track locations, status, and field visibility across your portfolio.",
  },
  "/customers": {
    title: "Customers",
    description: "Manage customer relationships, service history, and account context.",
  },
  [ROUTES.INSTALLED_SYSTEMS]: {
    title: "Installed Systems",
    description:
      "Anchor permanent technical identities so permits, jobs, and service work inherit the same trusted system truth.",
  },
  "/vehicle-alerts": {
    title: "Vehicle Alerts",
    description: "Monitor fleet issues, response status, and field escalation activity.",
  },
  // Resources
  [ROUTES.INVENTORY]: {
    title: "Inventory",
    description: "Track material availability, job allocations, and warehouse readiness.",
  },
  [ROUTES.COMPANY_BRAIN]: {
    title: "Company Brain",
    description: "Search shared knowledge, procedures, and operational context.",
  },
  // Insights
  [ROUTES.REPORTING]: {
    title: "Reporting",
    description: "Interpret operational performance across time, domains, and teams.",
  },
  // Workspace
  [ROUTES.SETTINGS]: {
    title: "Settings",
    description: "Configure system preferences, users, and workspace behavior.",
  },
};

function getPageMeta(pathname: string) {
  const directMatch = pageContent[pathname];
  if (directMatch) return directMatch;

  if (pathname.startsWith("/customers/")) {
    return {
      title: "Customer Details",
      description: "Review account activity, notes, related jobs, and history.",
    };
  }
  if (pathname.startsWith("/properties/")) {
    return {
      title: "Property Details",
      description: "Inspect site information, service history, and related operational data.",
    };
  }
  if (pathname.startsWith(`${ROUTES.INSTALLED_SYSTEMS}/`)) {
    return {
      title: "Installed System Record",
      description:
        "Review the technical identity, catalog-backed profile, and workflow inheritance for this installed system.",
    };
  }
  if (pathname.startsWith(`${ROUTES.JOBS}/`)) {
    if (pathname.endsWith("/edit")) {
      return { title: "Edit Job", description: "Update job details, assignment, or schedule." };
    }
    return { title: "Job Details", description: "Review job progress, timeline, and field activity." };
  }

  return pageContent[ROUTES.DASHBOARD];
}

export default function Header() {
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [],
  );

  const isStaging = process.env.NEXT_PUBLIC_APP_ENV === "staging";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="flex min-h-20 items-center justify-between gap-6 px-6 py-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-full border border-red-500/20 bg-gradient-to-r from-red-500/10 to-blue-500/10 px-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Operations Hub
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
              <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
              {todayLabel}
            </span>

            {isStaging ? (
              <span className="status-warning inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]">
                Staging Preview
              </span>
            ) : (
              <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400 md:inline-flex">
                <Sparkles className="h-3.5 w-3.5 text-red-400" />
                Live Workspace
              </span>
            )}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {pageMeta.title}
          </h1>

          <p className="text-sm text-slate-400">{pageMeta.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            className="border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Search size={18} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Bell size={18} />
          </Button>

          <Button
            variant="secondary"
            className="gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/15 to-blue-500/10 text-white hover:from-red-500/20 hover:to-blue-500/15"
          >
            <User size={18} />
            <span>Collin</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
