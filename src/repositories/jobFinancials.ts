import "server-only";

import type {
  JobInvoiceRow,
  JobLineItemRow,
  JobPaymentRow,
} from "@/features/jobs/types/jobFinancials";
import { readJobPrice } from "./jobPrice";
import { getRepositoryContext } from "./supabaseContext";

function unavailable(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("job_line_items") ||
    message.includes("invoices") ||
    message.includes("payments")
  );
}

function cents(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export interface JobFinancialRows {
  totalCents: number | null;
  lineItems: JobLineItemRow[];
  invoices: Omit<JobInvoiceRow, "paidAppliedCents" | "flagMismatch">[];
  payments: (Omit<JobPaymentRow, "invoiceNumber"> & { invoiceId: string | null })[];
}

/**
 * Reads the imported SF money rows for one job. Tables verified against the
 * live schema 2026-11-04: job_financials, job_line_items, invoices, payments
 * all carry job_id; payments also carry invoice_id.
 */
export async function readJobFinancialRows(jobId: string): Promise<JobFinancialRows> {
  const { supabase, orgId } = await getRepositoryContext();

  const totalCents = await readJobPrice(jobId);

  const [itemsRes, invoicesRes, paymentsRes] = await Promise.all([
    supabase
      .from("job_line_items")
      .select("kind, name, description, qty, rate_cents, total_cents, is_discount")
      .eq("org_id", orgId)
      .eq("job_id", jobId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("invoices")
      .select("id, number, invoice_date, total_cents, is_paid, terms, po_number")
      .eq("org_id", orgId)
      .eq("job_id", jobId)
      .order("invoice_date", { ascending: true }),
    supabase
      .from("payments")
      .select("amount_cents, received_on, payment_type, reference_number, memo, invoice_id")
      .eq("org_id", orgId)
      .eq("job_id", jobId)
      .order("received_on", { ascending: true }),
  ]);

  for (const res of [itemsRes, invoicesRes, paymentsRes]) {
    if (res.error && !unavailable(res.error)) throw new Error(res.error.message);
  }

  const lineItems: JobLineItemRow[] = (itemsRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      kind: (r.kind as string | null) ?? null,
      name: (r.name as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      qty: typeof r.qty === "number" ? r.qty : r.qty == null ? null : Number(r.qty),
      rateCents: cents(r.rate_cents as number | string | null),
      totalCents: cents(r.total_cents as number | string | null),
      isDiscount: r.is_discount === true,
    };
  });

  const invoices: JobFinancialRows["invoices"] = (invoicesRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      number: (r.number as string | null) ?? null,
      invoiceDate: (r.invoice_date as string | null) ?? null,
      totalCents: cents(r.total_cents as number | string | null),
      isPaid: r.is_paid === true,
      terms: (r.terms as string | null) ?? null,
      poNumber: (r.po_number as string | null) ?? null,
    };
  });

  const payments: JobFinancialRows["payments"] = (paymentsRes.data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      amountCents: cents(r.amount_cents as number | string | null),
      receivedOn: (r.received_on as string | null) ?? null,
      paymentType: (r.payment_type as string | null) ?? null,
      referenceNumber: (r.reference_number as string | null) ?? null,
      memo: (r.memo as string | null) ?? null,
      invoiceId: (r.invoice_id as string | null) ?? null,
    };
  });

  return { totalCents, lineItems, invoices, payments };
}
