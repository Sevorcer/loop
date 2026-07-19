import { AlertTriangle, CheckCircle2, ShieldAlert, Zap } from "lucide-react";

import type { OperationalHealthSummary } from "../types/liveOps";

interface OperationalHealthProps {
  health: OperationalHealthSummary;
}

const stateConfig = {
  healthy: {
    icon: <CheckCircle2 className="h-5 w-5 text-green-400" />,
    iconBg: "bg-green-500/10",
    border: "border-green-500/20",
    bg: "bg-green-500/[0.04]",
    headingColor: "text-green-300",
  },
  minor_issues: {
    icon: <Zap className="h-5 w-5 text-yellow-400" />,
    iconBg: "bg-yellow-500/10",
    border: "border-yellow-500/15",
    bg: "bg-yellow-500/[0.03]",
    headingColor: "text-yellow-300",
  },
  needs_attention: {
    icon: <AlertTriangle className="h-5 w-5 text-orange-400" />,
    iconBg: "bg-orange-500/10",
    border: "border-orange-500/20",
    bg: "bg-orange-500/[0.04]",
    headingColor: "text-orange-300",
  },
  critical: {
    icon: <ShieldAlert className="h-5 w-5 text-red-400" />,
    iconBg: "bg-red-500/10",
    border: "border-red-500/25",
    bg: "bg-red-500/[0.05]",
    headingColor: "text-red-300",
  },
};

export function OperationalHealth({ health }: OperationalHealthProps) {
  const cfg = stateConfig[health.state];

  return (
    <div
      className={[
        "rounded-3xl border p-5",
        cfg.border,
        cfg.bg,
      ].join(" ")}
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Operational Health
      </h2>

      <div className="flex items-center gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            cfg.iconBg,
          ].join(" ")}
        >
          {cfg.icon}
        </div>
        <div>
          <p className={["text-lg font-bold leading-none", cfg.headingColor].join(" ")}>
            {health.label}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {health.reasons.map((reason) => (
          <li key={reason} className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-1 w-1 shrink-0 rounded-full bg-slate-500" />
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
