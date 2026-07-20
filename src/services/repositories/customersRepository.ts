import { mockCustomers } from "@/features/customers/data/mockCustomers";
import type { Customer } from "@/features/customers/types/customer";
import {
  applySort,
  isFilterMatch,
  paginateItems,
  type CrudRepository,
  type RepositoryQuery,
} from "@/lib/repositories/contracts";

export type CustomersRepositoryErrorCode = "NOT_FOUND" | "INVALID_INPUT";

export type CustomersFilterField = "status" | "city" | "primaryContact";

export type CustomersSortField = "name" | "createdAt" | "lastActivity";

export type CustomersListQuery = RepositoryQuery<
  CustomersFilterField,
  CustomersSortField
>;

export type CustomerWriteInput = Partial<Customer>;

export type CustomersRepository = CrudRepository<
  Customer,
  CustomerWriteInput,
  CustomerWriteInput,
  CustomersFilterField,
  CustomersSortField,
  CustomersRepositoryErrorCode
>;

const fallbackCustomer: Customer = {
  id: "customer-template",
  name: "Unknown customer",
  primaryContact: "Unknown contact",
  email: "unknown@example.com",
  phone: "",
  city: "Unknown",
  status: "Prospect",
  propertyCount: 0,
  openJobs: 0,
  lastActivity: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString().slice(0, 10),
};

export const customersRepository: CustomersRepository = {
  async list(query) {
    const filtered = mockCustomers.filter((customer) =>
      isFilterMatch(customer, query?.filters)
    );
    const sorted = applySort(filtered, query?.sort);

    return {
      ok: true,
      data: paginateItems(sorted, query?.pagination),
    };
  },

  async getById(id) {
    const customer = mockCustomers.find((item) => item.id === id);

    if (!customer) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Customer '${id}' not found.`,
        },
      };
    }

    return { ok: true, data: customer };
  },

  async create(input) {
    return {
      ok: true,
      data: {
        ...fallbackCustomer,
        ...input,
        id: input.id ?? crypto.randomUUID(),
      },
    };
  },

  async update(id, input) {
    const existing = mockCustomers.find((item) => item.id === id);
    if (!existing) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Customer '${id}' not found.`,
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
