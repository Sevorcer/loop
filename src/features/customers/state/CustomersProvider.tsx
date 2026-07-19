"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { mockCustomers } from "../data/mockCustomers";
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
  getCustomerById: (id: string) => Customer | undefined;
  createCustomer: (input: CreateCustomerInput) => Customer;
}

const CUSTOMERS_STORAGE_KEY = "loop.customers.items";

const subscribeToHydration = (onStoreChange: () => void) => {
  void onStoreChange;
  return () => {};
};

function parseStoredValue<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (typeof window === "undefined") {
      return mockCustomers;
    }

    return parseStoredValue<Customer[]>(
      window.localStorage.getItem(CUSTOMERS_STORAGE_KEY),
      mockCustomers
    );
  });

  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      CUSTOMERS_STORAGE_KEY,
      JSON.stringify(customers)
    );
  }, [hydrated, customers]);

  const value = useMemo<CustomersContextValue>(() => {
    function getCustomerById(id: string) {
      return customers.find((c) => c.id === id);
    }

    function createCustomer(input: CreateCustomerInput): Customer {
      const timestamp = new Date().toISOString();

      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        name: input.name,
        primaryContact: input.primaryContact,
        email: input.email,
        phone: input.phone,
        city: input.city,
        status: input.status,
        propertyCount: 0,
        openJobs: 0,
        lastActivity: timestamp.slice(0, 10),
        createdAt: timestamp.slice(0, 10),
      };

      setCustomers((current) => [newCustomer, ...current]);
      return newCustomer;
    }

    return {
      hydrated,
      customers,
      getCustomerById,
      createCustomer,
    };
  }, [hydrated, customers]);

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
