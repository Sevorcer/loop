import "server-only";

import type { Organization, OrganizationListResult } from "@/repositories/organizations";
import {
  createOrganization as createOrganizationRecord,
  getOrganizationById,
  listOrganizations as listOrganizationRecords,
  softDeleteOrganization as softDeleteOrganizationRecord,
  updateOrganization as updateOrganizationRecord,
} from "@/repositories/organizations";
import type {
  CreateOrganizationInput,
  ListOrganizationsQuery,
  UpdateOrganizationInput,
} from "@/lib/schemas/organizations";

// Re-export schemas and types for convenience
export {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  ListOrganizationsQuerySchema,
} from "@/lib/schemas/organizations";
export type { CreateOrganizationInput, UpdateOrganizationInput, ListOrganizationsQuery };

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listOrganizations(
  query: ListOrganizationsQuery,
): Promise<OrganizationListResult> {
  return listOrganizationRecords({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    includeDeleted: query.includeDeleted,
  });
}

export async function getOrganization(id: string): Promise<Organization | null> {
  return getOrganizationById(id);
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  return createOrganizationRecord({ name: input.name });
}

export async function updateOrganization(
  id: string,
  input: UpdateOrganizationInput,
): Promise<Organization | null> {
  const existing = await getOrganizationById(id);

  if (!existing) {
    return null;
  }

  return updateOrganizationRecord(id, { name: input.name });
}

export async function deleteOrganization(id: string): Promise<boolean> {
  return softDeleteOrganizationRecord(id);
}
