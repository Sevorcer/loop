"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { EmptyState, ErrorState, StatusBadge } from "@/components/atlas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { formatDateOnly } from "@/lib/dates";
import { formatCentsAsUsd } from "@/lib/money";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { CustomerInvoiceRow, CustomerInvoiceSummary } from "../types/customerInvoices";

interface InvoicesResponse {
  invoices: CustomerInvoiceRow[];
  summary: CustomerInvoiceSummary;
  rolledUp: boolean;
}

/** Read-only invoices for a customer account: paid vs still waiting. */
export function CustomerInvoicesTab({ customerId }: { customerId: string }) {
  const { role } = useCurrentRole();
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    requestJson<InvoicesResponse>(`/api/customers/${customerId}/invoices`, { role, cache: "no-store" })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load invoices.");
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, role]);

  if (error) return <ErrorState title="Unable to load invoices" description={error} />;
  if (!data) return <p className="p-4 text-sm text-muted-foreground">Loading invoices...</p>;
  if (data.invoices.length === 0) {
    return (
      <EmptyState
        title="No invoices yet"
        description="Invoices imported from QuickBooks / Service Fusion for this account appear here."
      />
    );
  }

  const { summary } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCentsAsUsd(summary.outstandingCents)}</p>
            <p className="text-xs text-muted-foreground">{summary.awaitingCount} awaiting payment</p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCentsAsUsd(summary.paidCents)}</p>
            <p className="text-xs text-muted-foreground">{summary.paidCount} paid</p>
          </div>
        </div>
        {data.rolledUp ? (
          <p className="text-xs text-muted-foreground">
            Includes invoices from this account&apos;s linked job sites, same as the Jobs tab.
          </p>
        ) : null}

        <ul className="divide-y divide-border rounded-xl border">
          {data.invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-foreground">
                  Invoice {invoice.number || "(no number)"}
                  {invoice.invoiceDate ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">{formatDateOnly(invoice.invoiceDate)}</span>
                  ) : null}
                </p>
                {data.rolledUp && invoice.customerName ? (
                  <p className="text-xs text-muted-foreground">{invoice.customerName}</p>
                ) : null}
                {invoice.jobId ? (
                  <Link
                    href={ROUTE_BUILDERS.JOB_DETAIL(invoice.jobId)}
                    className="block truncate text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {[invoice.jobNumber, invoice.jobTitle].filter(Boolean).join(" · ") || "View job"}
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">Not linked to a job</p>
                )}
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                <p className="font-semibold text-foreground">{formatCentsAsUsd(invoice.totalCents)}</p>
                <StatusBadge variant={invoice.isPaid ? "success" : "warning"}>
                  {invoice.isPaid ? "Paid" : "Awaiting"}
                </StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
