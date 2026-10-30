import { Building2, Briefcase, Users } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/lib/routes";
import type { DashboardSummary } from "@/repositories/dashboard";

interface HomeSummaryCardsProps {
  summary: DashboardSummary;
}

export function HomeSummaryCards({ summary }: HomeSummaryCardsProps) {
  const cards = [
    {
      label: "Total Properties",
      value: summary.totalProperties,
      icon: Building2,
      href: ROUTES.PROPERTIES,
      color: "text-blue-300",
    },
    {
      label: "Active Jobs",
      value: summary.activeJobs,
      icon: Briefcase,
      href: ROUTES.JOBS,
      color: "text-red-300",
    },
    {
      label: "New Customers",
      value: summary.newCustomersThisMonth,
      icon: Users,
      href: ROUTES.CUSTOMERS,
      color: "text-emerald-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Link
            key={card.label}
            href={card.href}
          className="group rounded-2xl border border-default bg-surface p-5 transition-all hover:bg-surface-elevated"
        >
          <div className="flex items-center justify-between">
            <p className="text-muted text-xs font-semibold uppercase tracking-[0.18em]">
              {card.label}
            </p>
              <Icon
                className={`h-4 w-4 ${card.color} opacity-70 transition-opacity group-hover:opacity-100`}
              />
            </div>

            <p className="text-primary mt-3 text-3xl font-bold tracking-tight">
              {card.value}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
