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
  createCustomer: (input: CreateCustomerInput) => Promise<Customer>;
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

function getDevRole() {
  if (typeof window === "undefined") {
    return "owner";
  }

  return window.localStorage.getItem("loop_dev_role") ?? "owner";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-loop-role": getDevRole(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }

  return payload;
}

export function CustomersProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<{ customers: Customer[] }>("/api/customers");
      setCustomers(payload.customers);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load customers."
      );
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refreshCustomers();
  }, [refreshCustomers]);

  const value = useMemo<CustomersContextValue>(() => {
    function getCustomerById(id: string) {
      return customers.find((customer) => customer.id === id);
    }

    async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
      const payload = await requestJson<{ customer: Customer }>("/api/customers", {
        method: "POST",
        body: JSON.stringify(input),
      });

      setCustomers((current) => [payload.customer, ...current]);
      return payload.customer;
    }

    return {
      hydrated,
      loading,
      error,
      customers,
      getCustomerById,
      refreshCustomers,
      createCustomer,
    };
  }, [customers, error, hydrated, loading, refreshCustomers]);

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
