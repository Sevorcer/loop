"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, User, Sparkles, CalendarDays, Menu, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const headerDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

interface PageMeta {
  title: string;
  description: string;
  parent?: { title: string; href: string };
}

const pageContent: Record<string, PageMeta> = {
  [ROUTES.DASHBOARD]: {
    title: "Dashboard",
    description: "Welcome back. Here's what's happening today.",
  },
  // Operations
  [ROUTES.OPERATIONS]: {
    title: "Operations",
    description: "Coordinate schedules, dispatch, and field execution from one hub.",
  },
  [ROUTES.COMMAND_CENTER]: {
    title: "Command Center",
    description:
      "Operational health at a glance — risk, crew load, and intervention priorities for today.",
  },
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
  [ROUTES.CALENDAR]: {
    title: "Calendar",
    description: "See scheduled jobs by date. Unscheduled jobs are managed in Daily Plans.",
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
  [ROUTES.CUSTOMERS]: {
    title: "Customers",
    description: "Manage customer relationships, service history, and account context.",
  },
  [ROUTES.CONTRACTORS]: {
    title: "Contractors",
    description: "Manage contractor relationships, certifications, and assignments.",
  },
  [ROUTES.INSTALLED_SYSTEMS]: {
    title: "Installed Systems",
    description:
      "Anchor permanent technical identities so permits, jobs, and service work inherit the same trusted system truth.",
  },
  [ROUTES.VEHICLE_ALERTS]: {
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
  [ROUTES.SETTINGS_USERS]: {
    title: "Users",
    description: "Manage team members, roles, and invitations.",
    parent: { title: "Settings", href: ROUTES.SETTINGS },
  },
  [ROUTES.SETTINGS_APPEARANCE]: {
    title: "Appearance",
    description: "Customize theme, layout, and navigation preferences.",
    parent: { title: "Settings", href: ROUTES.SETTINGS },
  },
  [ROUTES.SETTINGS_ROLES]: {
    title: "Roles & Permissions",
    description: "Control what each role can see and do.",
    parent: { title: "Settings", href: ROUTES.SETTINGS },
  },
  [ROUTES.SETTINGS_FEEDBACK]: {
    title: "Feedback",
    description: "Review in-app feedback submitted from Settings.",
    parent: { title: "Settings", href: ROUTES.SETTINGS },
  },
  [ROUTES.OPS_FEEDBACK]: {
    title: "Feedback Reports",
    description: "Triage in-app feedback from the pilot team — review, prioritize, and resolve.",
  },
};

interface DynamicRoute {
  test: (pathname: string) => boolean;
  meta: PageMeta;
}

// Ordered most-specific first: /new and /edit must come before /:id.
const dynamicPageMeta: DynamicRoute[] = [
  {
    test: (p) => p === `${ROUTES.JOBS}/new`,
    meta: {
      title: "New Job",
      description: "Create a job and get it ready for scheduling.",
      parent: { title: "Jobs", href: ROUTES.JOBS },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.JOBS}/`) && p.endsWith("/edit"),
    meta: {
      title: "Edit Job",
      description: "Update job details, assignment, or schedule.",
      parent: { title: "Jobs", href: ROUTES.JOBS },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.JOBS}/`),
    meta: {
      title: "Job Details",
      description: "Review job progress, timeline, and field activity.",
      parent: { title: "Jobs", href: ROUTES.JOBS },
    },
  },
  {
    test: (p) => p === `${ROUTES.CUSTOMERS}/new`,
    meta: {
      title: "New Customer",
      description: "Add a customer to your service portfolio.",
      parent: { title: "Customers", href: ROUTES.CUSTOMERS },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.CUSTOMERS}/`) && p.endsWith("/edit"),
    meta: {
      title: "Edit Customer",
      description: "Update customer details and account context.",
      parent: { title: "Customers", href: ROUTES.CUSTOMERS },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.CUSTOMERS}/`),
    meta: {
      title: "Customer Details",
      description: "Review account activity, notes, related jobs, and history.",
      parent: { title: "Customers", href: ROUTES.CUSTOMERS },
    },
  },
  {
    test: (p) => p === `${ROUTES.PROPERTIES}/new`,
    meta: {
      title: "Create Property",
      description: "Capture a new service location and add it to your property portfolio.",
      parent: { title: "Properties", href: ROUTES.PROPERTIES },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.PROPERTIES}/`) && p.endsWith("/edit"),
    meta: {
      title: "Edit Property",
      description: "Update site information and service context.",
      parent: { title: "Properties", href: ROUTES.PROPERTIES },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.PROPERTIES}/`),
    meta: {
      title: "Property Details",
      description: "Inspect site information, service history, and related operational data.",
      parent: { title: "Properties", href: ROUTES.PROPERTIES },
    },
  },
  {
    test: (p) => p === `${ROUTES.CONTRACTORS}/new`,
    meta: {
      title: "New Contractor",
      description: "Add a contractor to your field network.",
      parent: { title: "Contractors", href: ROUTES.CONTRACTORS },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.INSTALLED_SYSTEMS}/`) && p.endsWith("/edit"),
    meta: {
      title: "Edit Installed System",
      description: "Update the technical identity and profile for this installed system.",
      parent: { title: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.INSTALLED_SYSTEMS}/`),
    meta: {
      title: "Installed System Record",
      description:
        "Review the technical identity, catalog-backed profile, and workflow inheritance for this installed system.",
      parent: { title: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS },
    },
  },
  {
    test: (p) => p === `${ROUTES.COMPANY_BRAIN}/new`,
    meta: {
      title: "New Knowledge Entry",
      description: "Capture a procedure, note, or piece of shared context.",
      parent: { title: "Company Brain", href: ROUTES.COMPANY_BRAIN },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.COMPANY_BRAIN}/`) && p.endsWith("/edit"),
    meta: {
      title: "Edit Knowledge Entry",
      description: "Update this shared knowledge entry.",
      parent: { title: "Company Brain", href: ROUTES.COMPANY_BRAIN },
    },
  },
  {
    test: (p) => p.startsWith(`${ROUTES.COMPANY_BRAIN}/`),
    meta: {
      title: "Knowledge Entry",
      description: "Review this shared procedure or operational note.",
      parent: { title: "Company Brain", href: ROUTES.COMPANY_BRAIN },
    },
  },
];

export function getPageMeta(pathname: string): PageMeta {
  const directMatch = pageContent[pathname];
  if (directMatch) return directMatch;

  const dynamicMatch = dynamicPageMeta.find((route) => route.test(pathname));
  if (dynamicMatch) return dynamicMatch.meta;

  return pageContent[ROUTES.DASHBOARD];
}

interface HeaderProps {
  isMobileNavOpen?: boolean;
  onMenuToggle?: () => void;
  onOpenCommandBar?: () => void;
}

export default function Header({
  isMobileNavOpen = false,
  onMenuToggle,
  onOpenCommandBar,
}: HeaderProps) {
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);
  const todayLabel = useMemo(() => headerDateFormatter.format(new Date()), []);

  const isStaging = process.env.NEXT_PUBLIC_APP_ENV === "staging";
  const showDashboardCrumb = pathname !== ROUTES.DASHBOARD;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl safe-area-header">
      {/* ── Mobile top bar (< sm) ── */}
      <div className="flex items-center gap-2 px-3 py-2 sm:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-navigation"
          onClick={onMenuToggle}
          className="h-9 w-9 shrink-0 border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <Menu size={17} />
        </Button>

        {showDashboardCrumb ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Link
              href={pageMeta.parent?.href ?? ROUTES.DASHBOARD}
              className="flex shrink-0 items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300"
              aria-label={pageMeta.parent ? `Back to ${pageMeta.parent.title}` : "Back to Dashboard"}
            >
              <ArrowLeft className="h-3 w-3" />
            </Link>
            <span className="text-slate-600" aria-hidden="true">/</span>
            <h1 className="min-w-0 truncate text-sm font-semibold text-white">
              {pageMeta.title}
            </h1>
          </div>
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {pageMeta.title}
          </h1>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open command bar (Cmd/Ctrl+K)"
            onClick={onOpenCommandBar}
            className="h-9 w-9 border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Search size={16} />
          </Button>

          <Link href={ROUTES.VEHICLE_ALERTS} aria-label="Notifications">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <Bell size={16} />
            </Button>
          </Link>

          <Link href={ROUTES.SETTINGS} aria-label="User menu">
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 border border-red-500/20 bg-gradient-to-r from-red-500/15 to-blue-500/10 text-white hover:from-red-500/20 hover:to-blue-500/15"
            >
              <User size={16} />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Desktop / tablet header (sm+) ── */}
      <div className="hidden sm:block">
        <div className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-navigation"
              onClick={onMenuToggle}
              className="mt-0.5 border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <Menu size={18} />
            </Button>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden h-7 items-center rounded-full border border-red-500/20 bg-gradient-to-r from-red-500/10 to-blue-500/10 px-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:inline-flex">
                  Operations Hub
                </span>

                <span
                  suppressHydrationWarning
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400"
                >
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

              <nav aria-label="Breadcrumbs" className="pt-0.5">
                <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  {showDashboardCrumb ? (
                    <>
                      <li>
                        <Link href={ROUTES.DASHBOARD} className="transition-colors hover:text-slate-300">
                          Dashboard
                        </Link>
                      </li>
                      <li aria-hidden="true" className="px-1 text-slate-600">
                        /
                      </li>
                      {pageMeta.parent ? (
                        <>
                          <li>
                            <Link
                              href={pageMeta.parent.href}
                              className="transition-colors hover:text-slate-300"
                            >
                              {pageMeta.parent.title}
                            </Link>
                          </li>
                          <li aria-hidden="true" className="px-1 text-slate-600">
                            /
                          </li>
                        </>
                      ) : null}
                      <li className="text-slate-300" aria-current="page">
                        {pageMeta.title}
                      </li>
                    </>
                  ) : (
                    <li className="text-slate-300">Dashboard</li>
                  )}
                </ol>
              </nav>

              <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {pageMeta.title}
              </h1>

              <p className="hidden max-w-2xl text-sm text-slate-400 sm:block">{pageMeta.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open command bar (Cmd/Ctrl+K)"
              onClick={onOpenCommandBar}
              className="border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <Search size={18} />
            </Button>

            <Link href={ROUTES.VEHICLE_ALERTS} aria-label="Notifications">
              <Button
                variant="ghost"
                size="icon"
                className="border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Bell size={18} />
              </Button>
            </Link>

            <Link href={ROUTES.SETTINGS} aria-label="User menu">
              <Button
                variant="secondary"
                className="gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/15 to-blue-500/10 px-3 text-white hover:from-red-500/20 hover:to-blue-500/15"
              >
                <User size={18} />
                <span className="hidden sm:inline">Collin</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
