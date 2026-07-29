import { formatPropertyAddress } from "@/features/properties/utils/formatPropertyAddress";
import type { Customer } from "@/features/customers/types/customer";
import type { Property } from "@/features/properties/types/property";

export type JobCustomerOption = Pick<
  Customer,
  "id" | "name" | "primaryContact" | "phone" | "email"
>;

export type JobPropertyOption = Pick<
  Property,
  "id" | "name" | "customerId" | "customer" | "address" | "city"
>;

export interface SmartSelectionState {
  customerId?: string;
  propertyId?: string;
}

export interface SmartSelectionResult {
  state: SmartSelectionState;
  formPatch: Partial<{
    customerName: string;
    propertyName: string;
    location: string;
  }>;
}

function findCustomerByName(customers: JobCustomerOption[], name: string) {
  const normalized = name.trim().toLowerCase();
  return customers.find((customer) => customer.name.trim().toLowerCase() === normalized);
}

function findPropertyByName(properties: JobPropertyOption[], name: string) {
  const normalized = name.trim().toLowerCase();
  return properties.find((property) => property.name.trim().toLowerCase() === normalized);
}

export function getScopedProperties(
  properties: JobPropertyOption[],
  customerId?: string,
): JobPropertyOption[] {
  if (!customerId) {
    return properties;
  }
  return properties.filter((property) => property.customerId === customerId);
}

export function resolveInitialSmartSelection(
  customers: JobCustomerOption[],
  properties: JobPropertyOption[],
  context: SmartSelectionState,
): SmartSelectionResult {
  const property = context.propertyId
    ? properties.find((item) => item.id === context.propertyId)
    : undefined;
  if (property) {
    return {
      state: {
        propertyId: property.id,
        customerId: property.customerId ?? context.customerId,
      },
      formPatch: {
        customerName: property.customer,
        propertyName: property.name,
        location: formatPropertyAddress(property),
      },
    };
  }

  const customer = context.customerId
    ? customers.find((item) => item.id === context.customerId)
    : undefined;
  if (customer) {
    return {
      state: { customerId: customer.id },
      formPatch: { customerName: customer.name },
    };
  }

  return { state: {}, formPatch: {} };
}

export function applyCustomerAutocomplete(
  customers: JobCustomerOption[],
  value: string,
): SmartSelectionResult {
  const selectedCustomer = findCustomerByName(customers, value);
  if (!selectedCustomer) {
    return {
      state: {},
      formPatch: { customerName: value },
    };
  }

  return {
    state: { customerId: selectedCustomer.id },
    formPatch: { customerName: selectedCustomer.name },
  };
}

export function applyPropertyAutocomplete(
  properties: JobPropertyOption[],
  value: string,
): SmartSelectionResult {
  const selectedProperty = findPropertyByName(properties, value);
  if (!selectedProperty) {
    return {
      state: {},
      formPatch: { propertyName: value },
    };
  }

  return {
    state: {
      propertyId: selectedProperty.id,
      customerId: selectedProperty.customerId ?? undefined,
    },
    formPatch: {
      propertyName: selectedProperty.name,
      customerName: selectedProperty.customer,
      location: formatPropertyAddress(selectedProperty),
    },
  };
}

export function buildTechnicianSuggestions(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}
