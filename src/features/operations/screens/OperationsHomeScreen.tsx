import Link from "next/link";
import { CalendarDays, Radio, Send, LayoutDashboard } from "lucide-react";

import { PageHeader } from "@/components/atlas";
import { ROUTES } from "@/lib/routes";

import { OperationsNavBar } from "../components/OperationsNavBar";

/**
 * Icon map for operational phase cards.
 * Keyed by href to avoid coupling to display names.
 */
const PHASE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  [ROUTES.DAILY_PLANS]: CalendarDays,
  [ROUTES.LIVE_OPERATIONS]: Radio,
  [ROUTES.DISPATCH]: Send,
};

interface OperationalPhaseCardProps {
  name: string;
  description: string;
  href: string;
  accentClass: string;
}

function OperationalPhaseCard({
  name,
  description,
  href,
  accentClass,
}: OperationalPhaseCardProps) {
  const Icon = PHASE_ICONS[href] ?? LayoutDashboard;

  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-default bg-surface p-4 transition-colors hover:bg-surface-elevated"
    >
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
          accentClass,
        ].join(" ")}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium transition-colors group-hover:text-primary">{name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>
    </Link>
  );
}

const OPERATIONAL_PHASES: Array<
  Omit<OperationalPhaseCardProps, "accentClass"> & { accentClass: string }
> = [
  {
    name: "Morning Operations",
    description: "Assign crews, confirm readiness, and prepare the field before the day begins.",
    href: ROUTES.DAILY_PLANS,
    accentClass: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/20",
  },
  {
    name: "Live Operations",
    description: "Track active work, crews in the field, exceptions, and operational health.",
    href: ROUTES.LIVE_OPERATIONS,
    accentClass: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
  },
  {
    name: "Dispatch",
    description: "Commit jobs into motion, coordinate crew schedules, and manage the board.",
    href: ROUTES.DISPATCH,
    accentClass: "bg-blue-500/10 text-blue-300 ring-blue-500/20",
  },
];

/**
 * Operations Home screen — Sprint 30A PR1 skeleton.
 *
 * Serves as the orientation layer for the Operations section.
 * Surfaces the three primary operational phases and provides
 * quick navigation to each workflow.
 */
export function OperationsHomeScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations"
        description="Orient, prepare, dispatch, and execute — your daily operational workflow in one place."
      />

      <OperationsNavBar />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Operational phases
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OPERATIONAL_PHASES.map((phase) => (
            <OperationalPhaseCard key={phase.href} {...phase} />
          ))}
        </div>
      </section>
    </div>
  );
}
