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

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import { mockContractors } from "../data/mockContractors";
import type { Contractor } from "../types/contractor";
import type { CreateContractorInput } from "../types/contractor";
import { validateCreateContractorInput } from "../utils/contractorUtils";

interface ContractorsContextValue {
  hydrated: boolean;
  contractors: Contractor[];
  getContractorById: (id: string) => Contractor | undefined;
  createContractor: (
    input: CreateContractorInput
  ) => Promise<{ ok: true; contractor: Contractor } | { ok: false; error: string }>;
}

const CONTRACTORS_STORAGE_KEY = "loop.contractors.items";

// This no-op subscription satisfies useSyncExternalStore's API.
// The hydration signal is derived from the server/client boundary:
// the server snapshot always returns false and the client snapshot
// always returns true, so no external subscription is needed.
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

const ContractorsContext = createContext<ContractorsContextValue | null>(null);

export function ContractorsProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [contractors, setContractors] = useState<Contractor[]>(() => {
    if (typeof window === "undefined") {
      return mockContractors;
    }

    return parseStoredValue<Contractor[]>(
      window.localStorage.getItem(CONTRACTORS_STORAGE_KEY),
      mockContractors
    );
  });
  const [loadedFromServer, setLoadedFromServer] = useState(false);

  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  // F19: contractors live in the real `contractors` table. Load them once the
  // session role is known; on failure keep the local/mock fallback so the
  // directory UI still renders (e.g. before login).
  useEffect(() => {
    if (!role || loadedFromServer) {
      return;
    }

    let cancelled = false;

    requestJson<{ contractors: Contractor[] }>("/api/contractors", {
      cache: "no-store",
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setContractors(response.contractors);
        setLoadedFromServer(true);
        window.localStorage.setItem(
          CONTRACTORS_STORAGE_KEY,
          JSON.stringify(response.contractors)
        );
      })
      .catch(() => {
        // Graceful fallback: keep localStorage/mock data.
      });

    return () => {
      cancelled = true;
    };
  }, [role, loadedFromServer]);

  const value = useMemo<ContractorsContextValue>(() => {
    function getContractorById(id: string) {
      return contractors.find((c) => c.id === id);
    }

    async function createContractor(
      input: CreateContractorInput
    ): Promise<
      { ok: true; contractor: Contractor } | { ok: false; error: string }
    > {
      const validation = validateCreateContractorInput(contractors, input);

      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      try {
        const response = await requestJson<{ contractor: Contractor }>(
          "/api/contractors",
          {
            method: "POST",
            body: {
              companyName: input.companyName,
              contactName: input.contactName,
              email: input.email,
              phone: input.phone,
              trade: input.trade,
            },
          }
        );

        setContractors((current) => [...current, response.contractor]);

        return { ok: true, contractor: response.contractor };
      } catch (requestError) {
        return {
          ok: false,
          error:
            requestError instanceof Error
              ? requestError.message
              : "Unable to add contractor.",
        };
      }
    }

    return {
      hydrated,
      contractors,
      getContractorById,
      createContractor,
    };
  }, [contractors, hydrated]);

  return (
    <ContractorsContext.Provider value={value}>
      {children}
    </ContractorsContext.Provider>
  );
}

export function useContractors() {
  const context = useContext(ContractorsContext);

  if (!context) {
    throw new Error("useContractors must be used within a ContractorsProvider");
  }

  return context;
}
