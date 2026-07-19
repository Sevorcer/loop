import type { MaterialReadinessState } from "../types/inventory";
import { getReadinessLabel } from "../utils/inventoryUtils";

interface MaterialReadinessBadgeProps {
  state: MaterialReadinessState;
  className?: string;
}

const variantStyles: Record<MaterialReadinessState, string> = {
  ready:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  attention_needed:
    "border-amber-500/25 bg-amber-500/10 text-amber-300",
  blocked:
    "border-red-500/25 bg-red-500/10 text-red-300",
};

export function MaterialReadinessBadge({
  state,
  className = "",
}: MaterialReadinessBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em]",
        variantStyles[state],
        className,
      ].join(" ")}
    >
      {getReadinessLabel(state)}
    </span>
  );
}
