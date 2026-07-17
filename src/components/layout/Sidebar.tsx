"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Brain,
  Building2,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import { ROUTES } from "@/lib/routes";

const sections = [
  {
    title: "MAIN",
    items: [
      {
        label: "Dashboard",
        href: ROUTES.DASHBOARD,
        icon: LayoutDashboard,
      },
      {
        label: "Properties",
        href: ROUTES.PROPERTIES,
        icon: Building2,
      },
      {
        label: "Jobs",
        href: ROUTES.JOBS,
        icon: Briefcase,
      },
      {
        label: "Daily Plans",
        href: ROUTES.DAILY_PLANS,
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      {
        label: "Company Brain",
        href: ROUTES.COMPANY_BRAIN,
        icon: Brain,
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        label: "Settings",
        href: ROUTES.SETTINGS,
        icon: Settings,
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-surface border-default flex w-64 flex-col border-r">

      {/* Logo */}

      <div className="border-default border-b px-6 py-8">

        <h1 className="text-primary text-2xl font-bold tracking-tight">
          LOOP
        </h1>

        <p className="text-muted mt-2 text-sm leading-relaxed">
          Operating System
          <br />
          for Field Operations
        </p>

      </div>

      {/* Navigation */}

      <nav className="flex-1 px-4 py-6">

        {sections.map((section) => (

          <div
            key={section.title}
            className="mb-8"
          >

            <p className="text-muted mb-3 px-3 text-xs font-semibold tracking-[0.18em]">
              {section.title}
            </p>

            <div className="space-y-1">

              {section.items.map((item) => {

                const Icon = item.icon;

                const active = pathname === item.href;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={[
                      "group",
                      "relative",
                      "flex",
                      "items-center",
                      "gap-3",
                      "rounded-atlas-lg",
                      "px-4",
                      "py-3",
                      "transition-atlas",
                      active
                        ? "bg-surface-elevated text-primary"
                        : "text-muted hover-surface-elevated hover:text-primary",
                    ].join(" ")}
                  >

                    {active && (
                      <span className="bg-[var(--primary)] absolute left-0 top-2 bottom-2 w-1 rounded-r-full" />
                    )}

                    <Icon
                      size={18}
                      strokeWidth={2}
                    />

                    <span className="font-medium">
                      {item.label}
                    </span>

                  </Link>
                );

              })}

            </div>

          </div>

        ))}

      </nav>

      {/* Footer */}

      <div className="border-default border-t px-6 py-5">

        <p className="text-muted text-xs">
          ATLAS UI v1
        </p>

      </div>

    </aside>
  );
}