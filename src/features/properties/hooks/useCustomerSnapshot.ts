"use client";

import { useEffect, useState } from "react";

import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import type { Customer } from "@/features/customers/types/customer";

interface CustomerSnapshotState {
  customer: Customer | null;
  loading: boolean;
}

interface FetchResult {
  forId: string;
  customer: Customer | null;
}

/**
 * Lazily fetches a single customer record by ID.
 * Returns null (not loading) when no customerId is provided.
 */
export function useCustomerSnapshot(customerId: string | undefined): CustomerSnapshotState {
  const { role } = useCurrentRole();
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (!customerId || !role) return;

    let cancelled = false;

    void requestJson<{ customer: Customer }>(`/api/customers/${customerId}`, { role })
      .then(({ customer }) => {
        if (!cancelled) setFetchResult({ forId: customerId, customer });
      })
      .catch(() => {
        if (!cancelled) setFetchResult({ forId: customerId, customer: null });
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, role]);

  if (!customerId) return { customer: null, loading: false };
  if (!fetchResult || fetchResult.forId !== customerId) return { customer: null, loading: true };
  return { customer: fetchResult.customer, loading: false };
}
