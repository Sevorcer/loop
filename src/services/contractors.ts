import "server-only";

import type {
  Contractor,
  ContractorTrade,
  CreateContractorInput,
} from "@/features/contractors/types/contractor";
import {
  createContractorRecord,
  getContractorById,
  listContractors as listContractorRecords,
  updateContractorRecord,
  type ContractorWriteInput,
} from "@/repositories/contractors";

const CONTRACTOR_TRADES = new Set<ContractorTrade | "">([
  "",
  "HVAC",
  "Electrical",
  "Plumbing",
  "Roofing",
  "General",
  "Other",
]);

function normalizeContractorInput(input: CreateContractorInput): CreateContractorInput {
  return {
    companyName: input.companyName.trim(),
    contactName: input.contactName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    trade: input.trade,
  };
}

function validateContractorInput(input: CreateContractorInput) {
  if (!input.companyName) throw new Error("Company name is required.");
  if (!input.contactName) throw new Error("Contact name is required.");
  if (!input.email) throw new Error("Email is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error("Email address is not valid.");
  }
  if (!CONTRACTOR_TRADES.has(input.trade)) throw new Error("Invalid trade.");
}

export async function listContractors(): Promise<Contractor[]> {
  return listContractorRecords();
}

export async function createContractor(input: CreateContractorInput): Promise<Contractor> {
  const normalized = normalizeContractorInput(input);
  validateContractorInput(normalized);

  const existing = await listContractorRecords();
  const duplicate = existing.some((c) => c.email.toLowerCase() === normalized.email);

  if (duplicate) {
    throw new Error("A contractor with this email already exists.");
  }

  const writeInput: ContractorWriteInput = {
    companyName: normalized.companyName,
    contactName: normalized.contactName,
    email: normalized.email,
    phone: normalized.phone,
    trade: normalized.trade,
  };

  return createContractorRecord(writeInput);
}

export async function updateContractor(
  id: string,
  input: Partial<CreateContractorInput> & { active?: boolean },
): Promise<Contractor | null> {
  const existing = await getContractorById(id);

  if (!existing) {
    return null;
  }

  const writeInput: Partial<ContractorWriteInput> = {};

  if (input.companyName !== undefined) writeInput.companyName = input.companyName.trim();
  if (input.contactName !== undefined) writeInput.contactName = input.contactName.trim();
  if (input.email !== undefined) writeInput.email = input.email.trim().toLowerCase();
  if (input.phone !== undefined) writeInput.phone = input.phone.trim();
  if (input.trade !== undefined) {
    if (!CONTRACTOR_TRADES.has(input.trade)) throw new Error("Invalid trade.");
    writeInput.trade = input.trade;
  }
  if (input.active !== undefined) writeInput.active = input.active;

  return updateContractorRecord(id, writeInput);
}
