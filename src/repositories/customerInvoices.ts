import "server-only";

import type { CustomerInvoiceRow } from "@/features/customers/types/customerInvoices";
import { sortInvoicesNewestFirst } from "@/features/customers/utils/customerInvoices";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Read-only invoices for a customer account. Table verified against the live
// schema 2026-11-05 (invoices: customer_id, number, invoice_date, total_cents,
// is_paid, job_id; 2,370 rows). Money is bigint cents, which PostgREST can
// return as a number or a string.
// ---------------------------------------------------------------------------

const PAGE = 1000;
const MAX_ROWS = 5000;

function unavailable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || (error.message ?? "").includes("invoices");
}

function toCents(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

interface InvoiceDbRow {
  id: string;
  number: string | null;
  invoice_date: string | null;
  total_cents: number | string | null;
  is_paid: boolean | null;
  job_id: string | null;
  customer_id: string | null;
}

/**
 * Invoices for these customers (the account customer plus any child job sites
 * the caller rolled in), newest first. `customers` maps id -> display name.
 */
export async function listInvoicesForCustomers(customers: Map<string, string>): Promise<CustomerInvoiceRow[]> {
  const customerIds = [...customers.keys()];
  if (customerIds.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();

  const rows: InvoiceDbRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from("invoices")
      .select("id,number,invoice_date,total_cents,is_paid,job_id,customer_id")
      .eq("org_id", orgId)
      .in("customer_id", customerIds)
      .order("invoice_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      if (unavailable(error)) return [];
      throw new Error(error.message);
    }
    const page = (data ?? []) as InvoiceDbRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  // Link-through info for the invoices that point at a job.
  const jobIds = Array.from(new Set(rows.map((row) => row.job_id).filter((id): id is string => Boolean(id))));
  const jobs = new Map<string, { jobNumber: string; title: string }>();
  for (let index = 0; index < jobIds.length; index += 200) {
    const { data } = await supabase
      .from("jobs")
      .select("id,job_number,title")
      .eq("org_id", orgId)
      .in("id", jobIds.slice(index, index + 200));
    for (const job of (data ?? []) as { id: string; job_number: string | null; title: string | null }[]) {
      jobs.set(job.id, { jobNumber: job.job_number ?? "", title: job.title ?? "" });
    }
  }

  return sortInvoicesNewestFirst(
    rows.map((row): CustomerInvoiceRow => {
      const job = row.job_id ? jobs.get(row.job_id) : undefined;
      const customerId = row.customer_id ?? "";
      return {
        id: row.id,
        number: row.number ?? "",
        invoiceDate: row.invoice_date,
        totalCents: toCents(row.total_cents),
        isPaid: row.is_paid === true,
        jobId: row.job_id,
        jobNumber: job?.jobNumber ?? null,
        jobTitle: job?.title ?? null,
        customerId,
        customerName: customers.get(customerId) ?? "",
      };
    }),
  );
}
