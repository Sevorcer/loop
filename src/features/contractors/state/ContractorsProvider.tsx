"use client";

import {
  createContext,
  useCallback,
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
  refreshContractors: () => Promise<void>;
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
  //
  // #13 fix (2026-11-04): the list used to load exactly once per mount.
  // Creating a contractor happens in a NEW TAB (the panel's "Add one"
  // link is target=_blank) under a different provider mount, so the job
  // tab's list stayed stale and the new contractor could never be
  // assigned — Collin: "takes you to make a NEW contractor; no way to
  // assign an existing one." The list now also refetches when the tab
  // regains focus, and consumers can call refreshContractors().
  const loadContractors = useCallback(async () => {
    try {
      const response = await requestJson<{ contractors: Contractor[] }>(
        "/api/contractors",
        { cache: "no-store", role },
      );
      setContractors(response.contractors);
      setLoadedFromServer(true);
      window.localStorage.setItem(
        CONTRACTORS_STORAGE_KEY,
        JSON.stringify(response.contractors),
      );
    } catch {
      // Graceful fallback: keep localStorage/mock data.
    }
  }, [role]);

  useEffect(() => {
    if (!role || loadedFromServer) {
      return;
    }
    void loadContractors();
  }, [role, loadedFromServer, loadContractors]);

  useEffect(() => {
    if (!loadedFromServer) {
      return;
    }
    const onFocus = () => {
      void loadContractors();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadContractors();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadedFromServer, loadContractors]);

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
      refreshContractors: loadContractors,
      getContractorById,
      createContractor,
    };
  }, [contractors, hydrated, loadContractors]);

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
