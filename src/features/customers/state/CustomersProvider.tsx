"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { Customer, CustomerStatus } from "../types/customer";

export interface CreateCustomerInput {
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  city: string;
  status: CustomerStatus;
}

interface CustomersContextValue {
  hydrated: boolean;
  customers: Customer[];
  error: string | null;
  getCustomerById: (id: string) => Customer | undefined;
  createCustomer: (input: CreateCustomerInput) => Promise<Customer>;
  reload: () => Promise<void>;
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    if (!role) {
      return;
    }

    try {
      setError(null);
      const response = await requestJson<{ customers: Customer[] }>("/api/customers", {
        role,
        cache: "no-store",
      });
      setCustomers(response.customers);
    } catch (loadError) {
      setCustomers([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load customers.");
    } finally {
      setHydrated(true);
    }
  }, [role]);

  useEffect(() => {
    if (!role) {
      return;
    }

    void loadCustomers();
  }, [loadCustomers, role]);

  const value = useMemo<CustomersContextValue>(() => {
    function getCustomerById(id: string) {
      return customers.find((customer) => customer.id === id);
    }

    async function createCustomer(input: CreateCustomerInput) {
      const response = await requestJson<{ customer: Customer }>("/api/customers", {
        method: "POST",
        role,
        body: input,
      });

      setCustomers((current) => [response.customer, ...current]);
      return response.customer;
    }

    async function reload() {
      await loadCustomers();
    }

    return {
      hydrated,
      customers,
      error,
      getCustomerById,
      createCustomer,
      reload,
    };
  }, [customers, error, hydrated, loadCustomers, role]);

  return (
    <CustomersContext.Provider value={value}>
      {children}
    </CustomersContext.Provider>
  );
}

export function useCustomers() {
  const context = useContext(CustomersContext);

  if (!context) {
    throw new Error("useCustomers must be used within a CustomersProvider");
  }

  return context;
}
