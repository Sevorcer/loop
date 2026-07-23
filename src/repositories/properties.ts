// Minimal pattern change only where context is obtained:
// 1) add optional param: contextInput?: { userId: string }
// 2) pass it to getRepositoryContext(contextInput)

import "server-only";
import type {
  Property,
  PropertyLocation,
  PropertyStatus,
  PropertyType,
} from "@/features/properties/types/property";
import { OPEN_JOB_STATUS_EXCLUSION_FILTER, UNLINKED_CUSTOMER_LABEL } from "./shared";
import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

// ... existing interfaces/helpers unchanged ...

async function getCustomerNameMap(
  customerIds: string[],
  contextInput?: SessionRepositoryContextInput,
): Promise<Map<string, string>> {
  const uniqueCustomerIds = Array.from(new Set(customerIds.filter(Boolean)));
  const nameMap = new Map<string, string>();
  if (uniqueCustomerIds.length === 0) return nameMap;

  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("customers")
    .select("id,name")
    .eq("org_id", orgId)
    .in("id", uniqueCustomerIds);

  if (error) throw new Error(error.message);
  for (const customer of data ?? []) nameMap.set(customer.id as string, customer.name as string);
  return nameMap;
}

export async function listProperties(
  contextInput?: SessionRepositoryContextInput,
): Promise<Property[]> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  // rest unchanged...
}