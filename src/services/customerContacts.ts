import "server-only";

import type {
  CustomerContact,
  CustomerContactInput,
  ContactRole,
} from "@/features/customers/types/customerContact";
import { CONTACT_ROLES } from "@/features/customers/types/customerContact";
import {
  createContact as createContactRecord,
  deleteContact as deleteContactRecord,
  getContactById,
  listContactsByCustomerId as listContactsRepo,
  updateContact as updateContactRecord,
} from "@/repositories/customerContacts";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_ROLES = new Set<ContactRole>(CONTACT_ROLES);

function validateRole(role: string): ContactRole {
  if (!VALID_ROLES.has(role as ContactRole)) {
    throw Object.assign(
      new Error(`Invalid contact role '${role}'. Must be one of: ${CONTACT_ROLES.join(", ")}.`),
      { status: 400 },
    );
  }
  return role as ContactRole;
}

function validateContactInput(input: CustomerContactInput): CustomerContactInput {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const role = validateRole(input.role);

  if (!name && !phone && !email) {
    throw Object.assign(
      new Error("At least one of name, phone, or email is required."),
      { status: 400 },
    );
  }

  return { name, role, phone, email };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listCustomerContacts(
  customerId: string,
): Promise<CustomerContact[]> {
  return listContactsRepo(customerId);
}

export async function getCustomerContact(
  contactId: string,
): Promise<CustomerContact | null> {
  return getContactById(contactId);
}

export async function createCustomerContact(
  customerId: string,
  input: CustomerContactInput,
): Promise<CustomerContact> {
  const validated = validateContactInput(input);
  return createContactRecord({
    customerId,
    name: validated.name,
    role: validated.role,
    phone: validated.phone,
    email: validated.email,
  });
}

export async function updateCustomerContact(
  contactId: string,
  input: Partial<CustomerContactInput>,
): Promise<CustomerContact | null> {
  const update: Record<string, unknown> = {};

  if (input.name !== undefined) update.name = input.name.trim();
  if (input.role !== undefined) update.role = validateRole(input.role);
  if (input.phone !== undefined) update.phone = input.phone.trim();
  if (input.email !== undefined) update.email = input.email.trim();

  return updateContactRecord(contactId, update);
}

export async function deleteCustomerContact(
  contactId: string,
): Promise<boolean> {
  return deleteContactRecord(contactId);
}
