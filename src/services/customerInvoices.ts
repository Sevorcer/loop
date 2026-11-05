import "server-only";

import type { CustomerInvoiceRow, CustomerInvoiceSummary } from "@/features/customers/types/customerInvoices";
import { summarizeInvoices } from "@/features/customers/utils/customerInvoices";
import { getCustomerById } from "@/repositories/customers";
import { listInvoicesForCustomers } from "@/repositories/customerInvoices";

export interface CustomerInvoicesResult {
  invoices: CustomerInvoiceRow[];
  summary: CustomerInvoiceSummary;
  /** True when child job sites' invoices are rolled into this (parent) customer. */
  rolledUp: boolean;
}

/**
 * Invoices for a customer account. Follows the same pattern as the Jobs tab:
 * a parent (builder) customer rolls in its linked child job sites, each row
 * naming the customer that owns it. Returns null when the customer is missing.
 */
export async function getCustomerInvoices(customerId: string): Promise<CustomerInvoicesResult | null> {
  const customer = await getCustomerById(customerId);
  if (!customer) return null;

  const customers = new Map<string, string>([[customer.id, customer.name]]);
  for (const child of customer.childCustomers ?? []) customers.set(child.id, child.name);

  const invoices = await listInvoicesForCustomers(customers);
  return {
    invoices,
    summary: summarizeInvoices(invoices),
    rolledUp: (customer.childCustomers ?? []).length > 0,
  };
}
