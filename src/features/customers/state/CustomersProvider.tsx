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
  loading: boolean;
  error: string | null;
  customers: Customer[];
  getCustomerById: (id: string) => Customer | undefined;
  refreshCustomers: () => Promise<void>;
  reload: () => Promise<void>;
  createCustomer: (input: CreateCustomerInput) => Promise<Customer>;
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCustomers = useCallback(async () => {
    if (!role) {
      return;
    }

    setLoading(true);
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
      setLoading(false);
      setHydrated(true);
    }
  }, [role]);

  useEffect(() => {
    if (!role) {
      return;
    }

    queueMicrotask(() => {
      void refreshCustomers();
    });
  }, [refreshCustomers, role]);

  const value = useMemo<CustomersContextValue>(() => {
    function getCustomerById(id: string) {
      return customers.find((customer) => customer.id === id);
    }

    async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
      const response = await requestJson<{ customer: Customer }>("/api/customers", {
        method: "POST",
        role,
        body: input,
      });

      setCustomers((current) => [response.customer, ...current]);
      return response.customer;
    }

    async function reload() {
      await refreshCustomers();
    }

    return {
      hydrated,
      loading,
      error,
      customers,
      getCustomerById,
      refreshCustomers,
      reload,
      createCustomer,
    };
  }, [customers, error, hydrated, loading, refreshCustomers, role]);

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers() {
  const context = useContext(CustomersContext);

  if (!context) {
    throw new Error("useCustomers must be used within a CustomersProvider");
  }

  return context;
}
