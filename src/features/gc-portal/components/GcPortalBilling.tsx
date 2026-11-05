"use client";

/**
 * GcPortalBilling — GC Portal v2
 *
 * Billing snapshot card. Only rendered when portal_money_visible is true.
 * Shows revenue, payments received, and balance.
 */

import { Wallet } from "lucide-react";

import type { PortalBilling } from "../types/gcPortal";

interface GcPortalBillingProps {
  billing: PortalBilling;
}

export function GcPortalBilling({ billing }: GcPortalBillingProps) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Billing</h2>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {billing.revenueCents != null ? formatCents(billing.revenueCents) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payments</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {formatCents(billing.totalPaymentsCents)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p
              className={`mt-1 text-lg font-semibold ${
                billing.balanceCents > 0
                  ? "text-amber-400"
                  : billing.balanceCents === 0
                    ? "text-emerald-400"
                    : "text-foreground"
              }`}
            >
              {formatCents(billing.balanceCents)}
            </p>
          </div>
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
