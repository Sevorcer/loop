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
 */
export function useCustomerSnapshot(customerId: string | undefined): CustomerSnapshotState {
  const { role } = useCurrentRole();
  const [state, setState] = useState<CustomerSnapshotState>({
    customer: null,
    loading: Boolean(customerId),
  });

  useEffect(() => {
    if (!customerId || !role) {
      setState({ customer: null, loading: false });
      return;
    }

    let cancelled = false;

    setState({ customer: null, loading: true });

    void requestJson<{ customer: Customer }>(`/api/customers/${customerId}`, { role })
      .then(({ customer }) => {
        if (!cancelled) setState({ customer, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ customer: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, role]);

  return state;
}
