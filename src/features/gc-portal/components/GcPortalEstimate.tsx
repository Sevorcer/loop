"use client";

/**
 * GcPortalEstimate — GC Portal v2
 *
 * Shows the current bid (estimate) amount. Only rendered when
 * portal_money_visible is true and an estimate exists.
 */

import { Receipt } from "lucide-react";

import type { PortalEstimate } from "../types/gcPortal";

interface GcPortalEstimateProps {
  estimate: PortalEstimate;
}

export function GcPortalEstimate({ estimate }: GcPortalEstimateProps) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Estimate</h2>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Bid Amount</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatCents(estimate.amountCents)}
            </p>
          </div>
          <span className="inline-flex rounded-full bg-blue-900/40 px-2.5 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-700/40">
            {estimate.status}
          </span>
        </div>
      </div>
    </section>
  );
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
