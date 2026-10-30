"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Customer } from "@/features/customers/types/customer";
import type { Property } from "@/features/properties/types/property";
import type { PropertyDraft } from "@/features/jobs/utils/propertyPicker";
import { requestJson } from "@/lib/api/client";

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}

export function useCustomerPropertyOptions(role: string | null | undefined) {
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Property[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!role) return;
    void Promise.all([
      requestJson<{ customers: Customer[] }>("/api/customers", { role }),
      requestJson<{ properties: Property[] }>("/api/properties", { role }),
    ])
      .then(([customers, properties]) => {
        setCustomerOptions(customers.customers ?? []);
        setPropertyOptions(properties.properties ?? []);
        setError(null);
        setReady(true);
      })
      .catch(() => {
        setCustomerOptions([]);
        setPropertyOptions([]);
        setError(
          "Customer and property pickers are temporarily unavailable. Reload the page and try again before saving.",
        );
        setReady(true);
      });
  }, [role]);

  const loadPropertiesForCustomer = useCallback(
    async (customerId: string, search?: string) => {
      if (!role || !customerId) return;
      const params = new URLSearchParams({ customerId });
      if (search?.trim()) params.set("search", search.trim());
      const response = await requestJson<{ properties: Property[] }>(
        `/api/properties?${params.toString()}`,
        { role },
      );
      setPropertyOptions((current) => mergeById(current, response.properties ?? []));
    },
    [role],
  );

  const searchCustomers = useCallback(
    (text: string) => {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
      const query = text.trim();
      if (!query || !role) return;
      customerSearchTimer.current = setTimeout(() => {
        void requestJson<{ customers: Customer[] }>(
          `/api/customers?search=${encodeURIComponent(query)}`,
          { role },
        )
          .then((response) => {
            setCustomerOptions((current) => mergeById(current, response.customers ?? []));
          })
          .catch((searchError) => {
            console.error("[jobs] customer server search failed", searchError);
          });
      }, 300);
    },
    [role],
  );

  const createCustomer = useCallback(
    async (name: string) => {
      const response = await requestJson<{ customer: Customer }>("/api/customers", {
        method: "POST",
        body: { name },
        role,
      });
      setCustomerOptions((current) => mergeById(current, [response.customer]));
      return response.customer;
    },
    [role],
  );

  const createProperty = useCallback(
    async (draft: PropertyDraft & { customerId?: string; customerName?: string }) => {
      const response = await requestJson<{ property: Property }>("/api/properties", {
        method: "POST",
        body: {
          name: draft.name,
          customer: draft.customerName ?? "",
          customerId: draft.customerId ?? null,
          address: draft.address,
          city: draft.city,
          type: "Residential",
          status: "Active",
        },
        role,
      });
      setPropertyOptions((current) => mergeById(current, [response.property]));
      return response.property;
    },
    [role],
  );

  return {
    customerOptions,
    propertyOptions,
    ready,
    error,
    loadPropertiesForCustomer,
    searchCustomers,
    createCustomer,
    createProperty,
  };
}
