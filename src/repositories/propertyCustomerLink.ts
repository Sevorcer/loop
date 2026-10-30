export const UNLINKED_CUSTOMER_LABEL = "Unlinked Customer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CustomerNameRecord {
  id: string;
  name: string;
}

export interface JobCustomerHint {
  propertyId: string | null;
  propertyName: string;
  customerId: string | null;
  customerName: string;
}

export interface ResolvedPropertyCustomer {
  customerId?: string;
  customerName: string;
}

export function isCustomerUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function namesMatch(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return a.length > 0 && a === b;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Resolves the customer shown on a property.
 *
 * A stored customer_id wins when that customer still exists. When the foreign
 * key was never saved, a job that points at the same property can supply the
 * link — but only when every matching job agrees on one customer. Mixed
 * customers stay unlinked rather than guessing.
 */
export function resolvePropertyCustomer(input: {
  propertyId: string;
  propertyName: string;
  customerId: string | null;
  customers: CustomerNameRecord[];
  jobHints: JobCustomerHint[];
}): ResolvedPropertyCustomer {
  const customersById = new Map(input.customers.map((customer) => [customer.id, customer.name]));

  if (input.customerId && customersById.has(input.customerId)) {
    return {
      customerId: input.customerId,
      customerName: customersById.get(input.customerId) ?? UNLINKED_CUSTOMER_LABEL,
    };
  }

  const hints = input.jobHints.filter((hint) => {
    if (hint.propertyId && hint.propertyId === input.propertyId) return true;
    return namesMatch(hint.propertyName, input.propertyName);
  });

  const customerIds = unique(
    hints.map((hint) => hint.customerId).filter((id): id is string => Boolean(id)),
  );

  if (customerIds.length === 1) {
    const customerId = customerIds[0];
    const fromDirectory = customersById.get(customerId);
    const fromJob = hints.find((hint) => hint.customerId === customerId && hint.customerName.trim())?.customerName.trim();
    return {
      customerId,
      customerName: fromDirectory ?? fromJob ?? UNLINKED_CUSTOMER_LABEL,
    };
  }

  if (customerIds.length > 1) {
    return { customerName: UNLINKED_CUSTOMER_LABEL };
  }

  const names = unique(
    hints.map((hint) => hint.customerName.trim()).filter((name) => name.length > 0),
  );
  if (names.length === 1) {
    const matches = input.customers.filter((customer) => namesMatch(customer.name, names[0]));
    if (matches.length === 1) {
      return { customerId: matches[0].id, customerName: matches[0].name };
    }
    if (matches.length === 0) {
      return { customerName: names[0] };
    }
  }

  return { customerName: UNLINKED_CUSTOMER_LABEL };
}

export interface PropertyCustomerLinkRow {
  id: string;
  name: string;
  customerId: string | null;
}

/**
 * Groups properties by the customer resolvePropertyCustomer would show.
 * A property that stays "Unlinked Customer" is omitted. Direct customer_id
 * links and job links use the same rules as the property list.
 */
export function linkedPropertyIdsByCustomer(input: {
  properties: PropertyCustomerLinkRow[];
  customers: CustomerNameRecord[];
  jobHints: JobCustomerHint[];
}): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const property of input.properties) {
    const resolved = resolvePropertyCustomer({
      propertyId: property.id,
      propertyName: property.name,
      customerId: property.customerId,
      customers: input.customers,
      jobHints: input.jobHints,
    });
    if (!resolved.customerId) continue;
    const ids = grouped.get(resolved.customerId) ?? [];
    if (!ids.includes(property.id)) ids.push(property.id);
    grouped.set(resolved.customerId, ids);
  }

  return grouped;
}
