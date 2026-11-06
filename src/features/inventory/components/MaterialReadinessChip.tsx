import { StatusBadge } from "@/components/atlas/StatusBadge";

import type { MaterialReadinessLevel } from "../types/readiness";

const CHIP: Record<MaterialReadinessLevel, { label: string; variant: "success" | "info" | "warning" | "danger" }> = {
  ok: { label: "Ready", variant: "success" },
  arriving_in_time: { label: "Arriving", variant: "info" },
  short: { label: "Short", variant: "warning" },
  at_risk: { label: "At risk", variant: "danger" },
};

export function readinessLabel(level: MaterialReadinessLevel): string {
  return CHIP[level].label;
}

/** The four material readiness states as one chip. Advisory: it never blocks anything. */
export function MaterialReadinessChip({ level, className }: { level: MaterialReadinessLevel; className?: string }) {
  const chip = CHIP[level];
  return (
    <StatusBadge variant={chip.variant} className={className}>
      {chip.label}
    </StatusBadge>
  );
}
