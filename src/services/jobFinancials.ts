import "server-only";

import type { JobFinancials } from "@/features/jobs/types/jobFinancials";
import { getJobById } from "@/repositories/jobs";
import {
  readJobFinancialRows,
  type JobFinancialRows,
} from "@/repositories/jobFinancials";
import type { AppRole } from "@/services/authorization";
import {
  canSeeFinancials,
  getFinancialsVisibility,
  type FinancialsVisibility,
} from "@/services/orgSettings";

/**
 * Karl-only by Collin's ruling (2026-11-04): imported financial detail and
 * totals are the business owner's numbers. Governed by the org's
 * financials_visibility setting (default "owner"); the owner account may
 * loosen it in Settings. Karl Christensen has no LOOP account today — the
 * only human holding the owner role is Collin; Karl's account must carry
 * the owner role to see this section.
 */
export function canSeeJobFinancials(
  role: AppRole | string | null | undefined,
  visibility: FinancialsVisibility,
): boolean {
  return canSeeFinancials(role, visibility);
}

function denied(): Error {
  return Object.assign(
    new Error("Financial detail is restricted by the org's visibility setting."),
    { status: 403 },
  );
}

/** Pure composition: raw rows -> the picture the UI renders. */
export function composeJobFinancials(rows: JobFinancialRows): JobFinancials {
  const invoicedCents = rows.invoices.reduce(
    (sum, inv) => sum + (inv.totalCents ?? 0),
    0,
  );
  const paidCents = rows.payments.reduce(
    (sum, pay) => sum + (pay.amountCents ?? 0),
    0,
  );
  // Balance is against what was actually invoiced; for jobs with payments
  // but no imported invoice, fall back to the job total.
  const balanceBase = rows.invoices.length > 0 ? invoicedCents : (rows.totalCents ?? 0);
  const balanceCents = balanceBase - paidCents;

  const appliedByInvoice = new Map<string, number>();
  for (const pay of rows.payments) {
    if (!pay.invoiceId) continue;
    appliedByInvoice.set(
      pay.invoiceId,
      (appliedByInvoice.get(pay.invoiceId) ?? 0) + (pay.amountCents ?? 0),
    );
  }
  const numberByInvoice = new Map(rows.invoices.map((inv) => [inv.id, inv.number]));

  const invoices = rows.invoices.map((inv) => {
    const paidAppliedCents = appliedByInvoice.get(inv.id) ?? 0;
    const coveredByPayments = paidAppliedCents >= (inv.totalCents ?? 0);
    return {
      ...inv,
      paidAppliedCents,
      // The SF-era flag and the payments ledger are both shown; where they
      // disagree we flag it instead of silently trusting either one.
      flagMismatch: inv.isPaid !== coveredByPayments,
    };
  });

  const payments = rows.payments.map((pay) => ({
    amountCents: pay.amountCents,
    receivedOn: pay.receivedOn,
    paymentType: pay.paymentType,
    referenceNumber: pay.referenceNumber,
    memo: pay.memo,
    invoiceNumber: pay.invoiceId
      ? (numberByInvoice.get(pay.invoiceId) ?? null)
      : null,
  }));

  return {
    summary: {
      totalCents: rows.totalCents,
      invoicedCents,
      paidCents,
      balanceCents,
      hasImportedDetail:
        rows.lineItems.length > 0 || rows.invoices.length > 0 || rows.payments.length > 0,
    },
    lineItems: rows.lineItems,
    invoices,
    payments,
  };
}

export async function getJobFinancialsForRole(
  role: AppRole,
  jobId: string,
): Promise<JobFinancials> {
  const visibility = await getFinancialsVisibility();
  if (!canSeeJobFinancials(role, visibility)) throw denied();
  const job = await getJobById(jobId);
  if (!job) throw Object.assign(new Error("Job not found."), { status: 404 });
  return composeJobFinancials(await readJobFinancialRows(jobId));
}
