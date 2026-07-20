import { mockProperties } from "@/features/properties/data/mockProperties";
import type { Property } from "@/features/properties/types/property";
import {
  applySort,
  isFilterMatch,
  paginateItems,
  type CrudRepository,
  type RepositoryQuery,
} from "@/lib/repositories/contracts";

export type PropertiesRepositoryErrorCode = "NOT_FOUND" | "INVALID_INPUT";

export type PropertiesFilterField = "status" | "type" | "city" | "customer";

export type PropertiesSortField = "name" | "createdAt" | "lastVisit";

export type PropertiesListQuery = RepositoryQuery<
  PropertiesFilterField,
  PropertiesSortField
>;

export type PropertyWriteInput = Partial<Property>;

export type PropertiesRepository = CrudRepository<
  Property,
  PropertyWriteInput,
  PropertyWriteInput,
  PropertiesFilterField,
  PropertiesSortField,
  PropertiesRepositoryErrorCode
>;

const fallbackProperty: Property = {
  id: "property-template",
  name: "Unknown property",
  customer: "Unknown customer",
  address: "",
  city: "",
  type: "Residential",
  status: "Pending",
  primarySystem: "Unknown system",
  openJobs: 0,
  lastVisit: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString().slice(0, 10),
};

export const propertiesRepository: PropertiesRepository = {
  async list(query) {
    const filtered = mockProperties.filter((property) =>
      isFilterMatch(property, query?.filters)
    );
    const sorted = applySort(filtered, query?.sort);

    return {
      ok: true,
      data: paginateItems(sorted, query?.pagination),
    };
  },

  async getById(id) {
    const property = mockProperties.find((item) => item.id === id);

    if (!property) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Property '${id}' not found.`,
        },
      };
    }

    return { ok: true, data: property };
  },

  async create(input) {
    return {
      ok: true,
      data: {
        ...fallbackProperty,
        ...input,
        id: input.id ?? crypto.randomUUID(),
      },
    };
  },

  async update(id, input) {
    const existing = mockProperties.find((item) => item.id === id);
    if (!existing) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Property '${id}' not found.`,
        },
      };
    }

    return {
      ok: true,
      data: { ...existing, ...input, id },
    };
  },

  async delete(id) {
    return {
      ok: true,
      data: { id },
    };
  },
};
