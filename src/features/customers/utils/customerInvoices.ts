import type { CustomerInvoiceRow, CustomerInvoiceSummary } from "../types/customerInvoices";

/** Paid vs still-waiting totals for the Invoices tab header. */
export function summarizeInvoices(rows: Pick<CustomerInvoiceRow, "totalCents" | "isPaid">[]): CustomerInvoiceSummary {
  const summary: CustomerInvoiceSummary = { paidCents: 0, outstandingCents: 0, paidCount: 0, awaitingCount: 0 };
  for (const row of rows) {
    const cents = Number.isFinite(row.totalCents) ? row.totalCents : 0;
    if (row.isPaid) {
      summary.paidCents += cents;
      summary.paidCount += 1;
    } else {
      summary.outstandingCents += cents;
      summary.awaitingCount += 1;
    }
  }
  return summary;
}

/** Newest invoice first; undated invoices last. Stable for equal dates (by number). */
export function sortInvoicesNewestFirst<T extends Pick<CustomerInvoiceRow, "invoiceDate" | "number">>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const l = left.invoiceDate ? Date.parse(left.invoiceDate) : Number.NEGATIVE_INFINITY;
    const r = right.invoiceDate ? Date.parse(right.invoiceDate) : Number.NEGATIVE_INFINITY;
    if (l !== r) return r - l;
    return right.number.localeCompare(left.number, undefined, { numeric: true });
  });
}
