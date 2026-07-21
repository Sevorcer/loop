"use client";

import { useEffect, useState } from "react";

import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import type { Customer } from "@/features/customers/types/customer";

interface CustomerSnapshotState {
  customer: Customer | null;
  loading: boolean;
}

/**
 * Lazily fetches a single customer record by ID.
 * Returns null (not loading) when no customerId is provided.
 *
 * Design note: internal fetch state is tracked separately from the null-guard
 * case. When customerId is absent the hook derives {customer:null, loading:false}
 * without calling setState synchronously inside the effect body, which avoids
 * the cascading-render pattern flagged by react-hooks/set-state-in-effect.
 */
export function useCustomerSnapshot(customerId: string | undefined): CustomerSnapshotState {
  const { role } = useCurrentRole();

  // Tracks the result of an in-flight or completed fetch. When customerId is
  // absent we derive the final value instead of storing it here.
  const [fetchState, setFetchState] = useState<CustomerSnapshotState>({
    customer: null,
    loading: false,
  });

  useEffect(() => {
    if (!customerId || !role) {
      // Nothing to fetch. Any previous fetchState will be ignored via the
      // derived return below; reset so re-mounting with a valid ID starts
      // fresh.
      setFetchState({ customer: null, loading: false });
      return;
    }

    let cancelled = false;

    setFetchState({ customer: null, loading: true });

    void requestJson<{ customer: Customer }>(`/api/customers/${customerId}`, { role })
      .then(({ customer }) => {
        if (!cancelled) setFetchState({ customer, loading: false });
      })
      .catch(() => {
        if (!cancelled) setFetchState({ customer: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, role]);

  // When there is no customerId we never need to show a loading state.
  if (!customerId || !role) {
    return { customer: null, loading: false };
  }

  return fetchState;
}
