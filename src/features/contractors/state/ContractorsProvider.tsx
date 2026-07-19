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

import { mockContractors } from "../data/mockContractors";
import type { Contractor } from "../types/contractor";
import type { CreateContractorInput } from "../types/contractor";
import {
  buildContractor,
  validateCreateContractorInput,
} from "../utils/contractorUtils";

interface ContractorsContextValue {
  hydrated: boolean;
  contractors: Contractor[];
  getContractorById: (id: string) => Contractor | undefined;
  createContractor: (
    input: CreateContractorInput
  ) => { ok: true; contractor: Contractor } | { ok: false; error: string };
}

const CONTRACTORS_STORAGE_KEY = "loop.contractors.items";

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
  const [contractors, setContractors] = useState<Contractor[]>(() => {
    if (typeof window === "undefined") {
      return mockContractors;
    }

    return parseStoredValue<Contractor[]>(
      window.localStorage.getItem(CONTRACTORS_STORAGE_KEY),
      mockContractors
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
      CONTRACTORS_STORAGE_KEY,
      JSON.stringify(contractors)
    );
  }, [hydrated, contractors]);

  const value = useMemo<ContractorsContextValue>(() => {
    function getContractorById(id: string) {
      return contractors.find((c) => c.id === id);
    }

    function createContractor(
      input: CreateContractorInput
    ): { ok: true; contractor: Contractor } | { ok: false; error: string } {
      const validation = validateCreateContractorInput(contractors, input);

      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      const newContractor = buildContractor(input, crypto.randomUUID());

      setContractors((current) => [...current, newContractor]);

      return { ok: true, contractor: newContractor };
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
