"use client";

import { AlertTriangle, Rocket, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ActivationDialogProps {
  open: boolean;
  blockerCount: number;
  alertCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function buildBodyText(blockerCount: number, alertCount: number): string {
  if (blockerCount > 0) {
    const verb = pluralize(blockerCount, "is", "are");
    const noun = pluralize(blockerCount, "blocker", "blockers");
    const pronoun = pluralize(blockerCount, "has", "have");
    return `There ${verb} ${blockerCount} open ${noun} that ${pronoun} not been resolved. You can still launch, but these issues will carry forward into the active day.`;
  }
  if (alertCount > 0) {
    const verb = pluralize(alertCount, "is", "are");
    const noun = pluralize(alertCount, "active alert", "active alerts");
    return `There ${verb} ${alertCount} ${noun} to monitor, but no blockers. The company will transition from planning to operations.`;
  }
  return "All crews, trucks, and jobs are clear. The company is ready to transition from planning to operations.";
}

export function ActivationDialog({
  open,
  blockerCount,
  alertCount,
  onConfirm,
  onCancel,
}: ActivationDialogProps) {
  const hasBlockers = blockerCount > 0;

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activation-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0f1117] p-6 shadow-2xl">
        <button
          onClick={onCancel}
          aria-label="Cancel activation"
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
        >
          <X className="h-4 w-4" />
        </button>

        {hasBlockers ? (
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/15 text-yellow-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
        ) : (
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/15 text-green-300">
            <Rocket className="h-6 w-6" />
          </div>
        )}

        <h2 id="activation-dialog-title" className="text-lg font-semibold text-white">
          {hasBlockers ? "Launch with open blockers?" : "Start today's operations?"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {buildBodyText(blockerCount, alertCount)}
        </p>

        {hasBlockers && (
          <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-3 text-sm text-yellow-200">
            Launching with blockers means affected crews may face delays. Coordinate with field teams immediately after launch.
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={[
              "gap-2 rounded-xl font-semibold",
              hasBlockers
                ? "border border-yellow-500/30 bg-yellow-500/15 text-yellow-100 hover:bg-yellow-500/25"
                : "bg-green-600 text-white hover:bg-green-500",
            ].join(" ")}
          >
            <Rocket className="h-4 w-4" />
            {hasBlockers ? "Launch anyway" : "Start operations"}
          </Button>
        </div>
      </div>
    </div>
  );
}
