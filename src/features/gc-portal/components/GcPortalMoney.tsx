"use client";

/**
 * GcPortalMoney — Task 2/3
 *
 * Read-only money section for the builder portal. Shows price, change orders,
 * invoice info, balance, and retainer from the GC ledger.
 * Only rendered when portal_money_visible is true (data presence is the gate).
 */

import { DollarSign } from "lucide-react";
import type { PortalMoneyData } from "../types/gcPortal";

interface GcPortalMoneyProps {
  money: PortalMoneyData;
}

export function GcPortalMoney({ money }: GcPortalMoneyProps) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Financials</h2>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MoneyMetric label="Price" cents={money.priceCents} />
          <MoneyMetric label="Balance" cents={money.balanceCents} />
          <MoneyMetric label="Retainer Held" cents={money.retainerCents} />
          <div>
            <p className="text-xs text-muted-foreground">Invoice #</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {money.invoiceNumber ?? "—"}
            </p>
          </div>
        </div>

        {/* Invoice dates */}
        {(money.dateSent || money.dateReceived) && (
          <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4">
            {money.dateSent && (
              <div>
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="text-sm text-foreground">{formatDate(money.dateSent)}</p>
              </div>
            )}
            {money.dateReceived && (
              <div>
                <p className="text-xs text-muted-foreground">Received</p>
                <p className="text-sm text-foreground">{formatDate(money.dateReceived)}</p>
              </div>
            )}
          </div>
        )}

        {/* Change Orders */}
        {money.changeOrders.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-foreground">Change Orders</p>
            <div className="flex flex-col gap-2">
              {money.changeOrders.map((co) => (
                <div
                  key={co.id}
                  className="flex items-center justify-between rounded-md bg-surface-elevated px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-foreground">
                      {co.changeOrderNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">{co.description}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {formatCents(co.amountCents)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MoneyMetric({ label, cents }: { label: string; cents: number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">
        {cents != null ? formatCents(cents) : "—"}
      </p>
    </div>
  );
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
