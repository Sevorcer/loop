import "server-only";

import type {
  Contractor,
  ContractorTrade,
} from "@/features/contractors/types/contractor";

import { getRepositoryContext } from "./supabaseContext";

interface ContractorRow {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  trade: string;
  active: boolean;
  created_at: string;
}

export interface ContractorWriteInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  trade: ContractorTrade | "";
  active?: boolean;
}

const CONTRACTOR_SELECT =
  "id,company_name,contact_name,email,phone,trade,active,created_at";

function mapContractor(row: ContractorRow): Contractor {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    trade: (row.trade || "") as ContractorTrade | "",
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function listContractors(
  options?: { page?: number; pageSize?: number },
): Promise<Contractor[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("contractors")
    .select(CONTRACTOR_SELECT)
    .eq("org_id", orgId)
    .order("company_name", { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ContractorRow[]).map(mapContractor);
}

export async function getContractorById(id: string): Promise<Contractor | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("contractors")
    .select(CONTRACTOR_SELECT)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapContractor(data as ContractorRow) : null;
}

export async function createContractorRecord(
  input: ContractorWriteInput,
): Promise<Contractor> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("contractors")
    .insert({
      org_id: orgId,
      company_name: input.companyName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      trade: input.trade,
      active: input.active ?? true,
    })
    .select(CONTRACTOR_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapContractor(data as ContractorRow);
}

export async function updateContractorRecord(
  id: string,
  input: Partial<ContractorWriteInput>,
): Promise<Contractor | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const updatePayload: Record<string, unknown> = {};

  if (input.companyName !== undefined) updatePayload.company_name = input.companyName;
  if (input.contactName !== undefined) updatePayload.contact_name = input.contactName;
  if (input.email !== undefined) updatePayload.email = input.email;
  if (input.phone !== undefined) updatePayload.phone = input.phone;
  if (input.trade !== undefined) updatePayload.trade = input.trade;
  if (input.active !== undefined) updatePayload.active = input.active;

  const { data, error } = await supabase
    .from("contractors")
    .update(updatePayload)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(CONTRACTOR_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapContractor(data as ContractorRow) : null;
}
