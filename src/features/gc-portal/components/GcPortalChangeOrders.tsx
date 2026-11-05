"use client";

/**
 * GcPortalChangeOrders — GC Portal v2
 *
 * Lists change orders. Title and status are always visible.
 * Amounts are only visible when portal_money_visible is true
 * (controlled by presence of amountCents in the data).
 */

import { FileStack } from "lucide-react";

import type { PortalChangeOrderV2 } from "../types/gcPortal";

interface GcPortalChangeOrdersProps {
  changeOrders: PortalChangeOrderV2[];
}

export function GcPortalChangeOrders({ changeOrders }: GcPortalChangeOrdersProps) {
  if (changeOrders.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <FileStack className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Change Orders</h2>
      </div>

      <div className="space-y-2">
        {changeOrders.map((co) => (
          <div
            key={co.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">
                {co.title || "Change Order"}
              </span>
              <div className="mt-0.5">
                <COStatusBadge status={co.status} />
              </div>
            </div>
            {co.amountCents !== undefined && (
              <p className="ml-3 text-sm font-medium text-foreground">
                {formatCents(co.amountCents)}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function COStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    proposed: "text-blue-300 bg-blue-900/40 ring-1 ring-blue-700/40",
    approved: "text-emerald-300 bg-emerald-900/40 ring-1 ring-emerald-700/40",
    declined: "text-red-300 bg-red-900/40 ring-1 ring-red-700/40",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colorMap[status] ?? "text-slate-300 bg-slate-800/60"
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
