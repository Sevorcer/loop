"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Lock } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { formatCentsAsUsd } from "@/lib/money";
import type { JobFinancials } from "../types/jobFinancials";

/**
 * Imported financial detail for one job (Service Fusion line items,
 * invoices, payments). Owner-only: the API returns 403 for every other
 * role and this section renders nothing in that case. Read-only — LOOP
 * does not invoice; QuickBooks stays the system of record.
 */
export function JobMoneySection({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobFinancials | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${jobId}/financials`);
        if (!res.ok) {
          if (!cancelled) setHidden(true);
          return;
        }
        const json = (await res.json()) as JobFinancials;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setHidden(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (hidden || !data) return null;

  const { summary, lineItems, invoices, payments } = data;

  return (
    <SurfaceCard>
      <div className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Financial Detail</h2>
          <span className="text-xs text-slate-500">Owner only · imported</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Job total
            </p>
            <p className="mt-1 text-base font-semibold text-slate-100">
              {summary.totalCents == null ? "—" : formatCentsAsUsd(summary.totalCents)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Invoiced
            </p>
            <p className="mt-1 text-base font-semibold text-slate-100">
              {formatCentsAsUsd(summary.invoicedCents)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Paid
            </p>
            <p className="mt-1 text-base font-semibold text-slate-100">
              {formatCentsAsUsd(summary.paidCents)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Balance
            </p>
            <p className="mt-1 text-base font-semibold text-slate-100">
              {formatCentsAsUsd(summary.balanceCents)}
            </p>
          </div>
        </div>

        {!summary.hasImportedDetail ? (
          <p className="text-sm text-slate-400">
            No imported financial detail for this job.
          </p>
        ) : null}

        {lineItems.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Line items</h3>
            <ul className="mt-2 divide-y divide-white/5">
              {lineItems.map((item, idx) => (
                <li key={idx} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0 text-sm text-slate-300">
                    {item.name ?? "Charge"}
                    {item.qty != null && item.qty !== 1 ? (
                      <span className="text-slate-500"> × {item.qty}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm text-slate-200">
                    {formatCentsAsUsd(item.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {invoices.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Invoices</h3>
            <ul className="mt-2 space-y-2">
              {invoices.map((inv) => (
                <li key={inv.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-300">
                      #{inv.number ?? "—"}
                      {inv.invoiceDate ? (
                        <span className="text-slate-500">
                          {" "}
                          · {inv.invoiceDate.slice(0, 10)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-slate-200">
                      {formatCentsAsUsd(inv.totalCents)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className={inv.isPaid ? "text-emerald-400" : "text-amber-400"}>
                      {inv.isPaid ? "Paid" : "Open"}
                    </span>
                    {inv.terms ? <span className="text-slate-500">{inv.terms}</span> : null}
                    {inv.poNumber ? (
                      <span className="text-slate-500">PO {inv.poNumber}</span>
                    ) : null}
                    {inv.flagMismatch ? (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <CircleAlert className="h-3 w-3" />
                        payments say {inv.paidAppliedCents >= (inv.totalCents ?? 0) ? "paid" : "not fully paid"}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {payments.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Payments</h3>
            <ul className="mt-2 space-y-1.5">
              {payments.map((pay, idx) => (
                <li key={idx} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-slate-300">
                    {pay.receivedOn ? pay.receivedOn.slice(0, 10) : "—"}
                    {pay.paymentType ? (
                      <span className="text-slate-500"> · {pay.paymentType}</span>
                    ) : null}
                    {pay.invoiceNumber ? (
                      <span className="text-slate-500"> · Inv #{pay.invoiceNumber}</span>
                    ) : null}
                    {pay.referenceNumber ? (
                      <span className="text-slate-500"> · Ref {pay.referenceNumber}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-slate-200">
                    {formatCentsAsUsd(pay.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
