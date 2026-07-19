import { AlertTriangle, CircleAlert, ShieldCheck } from "lucide-react";

import type { MorningAlert } from "../types/dailyPlan";

interface AlertsBannerProps {
  alerts: MorningAlert[];
}

export function AlertsBanner({ alerts }: AlertsBannerProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-3xl border border-green-500/20 bg-green-500/[0.06] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-500/15 text-green-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-200">No active blockers</p>
            <p className="mt-1 text-sm leading-6 text-green-100/80">
              Crews, trucks, and materials are clear to leave the shop.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.06] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-100">Dispatch blockers</p>
            <p className="mt-1 text-sm leading-6 text-red-100/80">
              Resolve the blockers below before the first truck leaves the shop.
            </p>
          </div>
        </div>

        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
          {alerts.length} open alert{alerts.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {alerts.slice(0, 6).map((alert) => (
          <div
            key={alert.id}
            className={[
              "rounded-2xl border p-4",
              alert.severity === "critical"
                ? "border-red-500/25 bg-red-500/[0.08]"
                : alert.severity === "warning"
                  ? "border-yellow-500/20 bg-yellow-500/[0.06]"
                  : "border-white/10 bg-white/[0.03]",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <CircleAlert
                className={[
                  "mt-0.5 h-4 w-4 shrink-0",
                  alert.severity === "critical"
                    ? "text-red-300"
                    : alert.severity === "warning"
                      ? "text-yellow-300"
                      : "text-slate-300",
                ].join(" ")}
              />
              <div>
                <p className="text-sm font-semibold text-white">{alert.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{alert.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
