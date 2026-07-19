import type { Contractor, CreateContractorInput } from "../types/contractor";

export function validateCreateContractorInput(
  existing: Contractor[],
  input: CreateContractorInput
): { valid: true } | { valid: false; error: string } {
  const trimmedEmail = input.email.trim().toLowerCase();

  if (!input.companyName.trim()) {
    return { valid: false, error: "Company name is required." };
  }

  if (!input.contactName.trim()) {
    return { valid: false, error: "Contact name is required." };
  }

  if (!trimmedEmail) {
    return { valid: false, error: "Email is required." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { valid: false, error: "Email address is not valid." };
  }

  const duplicate = existing.some(
    (c) => c.email.trim().toLowerCase() === trimmedEmail
  );

  if (duplicate) {
    return {
      valid: false,
      error: "A contractor with this email already exists.",
    };
  }

  return { valid: true };
}

export function buildContractor(
  input: CreateContractorInput,
  id: string
): Contractor {
  return {
    id,
    companyName: input.companyName.trim(),
    contactName: input.contactName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    trade: input.trade,
    active: true,
    createdAt: new Date().toISOString(),
  };
}
