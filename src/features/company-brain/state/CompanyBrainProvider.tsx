"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type {
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeSearchQuery,
  KnowledgeSnapshot,
  KnowledgeUsage,
} from "../types/knowledgeItem";
import {
  assembleKnowledgeSnapshot,
  getItemsForDomain,
  getRelationshipsForItem,
  getUsageForItem,
  searchKnowledgeItems,
} from "../utils/knowledgeUtils";

interface CompanyBrainContextValue {
  snapshot: KnowledgeSnapshot;
  loading: boolean;
  error: string | null;
  getKnowledgeItemById: (id: string) => KnowledgeItem | undefined;
  getRelationshipsForItem: (knowledgeItemId: string) => KnowledgeRelationship[];
  getUsageForItem: (knowledgeItemId: string) => KnowledgeUsage[];
  searchKnowledge: (query: KnowledgeSearchQuery) => KnowledgeItem[];
  getItemsForDomain: (
    domain: KnowledgeItem["relatedDomains"][number]
  ) => KnowledgeItem[];
}

const EMPTY_SNAPSHOT: KnowledgeSnapshot = assembleKnowledgeSnapshot([], [], []);

const CompanyBrainContext = createContext<CompanyBrainContextValue | null>(null);

export function CompanyBrainProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;

    let cancelled = false;

    async function fetchSnapshot() {
      setLoading(true);
      setError(null);

      try {
        const json = await requestJson<{ snapshot?: KnowledgeSnapshot }>(
          "/api/knowledge-items",
          { role, cache: "no-store" },
        );

        if (!cancelled) {
          setSnapshot(json.snapshot ?? EMPTY_SNAPSHOT);
        }
      } catch {
        if (!cancelled) {
          setSnapshot(EMPTY_SNAPSHOT);
          setError("Unable to load company knowledge right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchSnapshot();

    return () => {
      cancelled = true;
    };
  }, [role]);

  const value = useMemo<CompanyBrainContextValue>(() => {
    function getKnowledgeItemById(id: string) {
      return snapshot.items.find((item) => item.id === id);
    }

    function getRelationshipsForItemFn(knowledgeItemId: string) {
      return getRelationshipsForItem(snapshot.relationships, knowledgeItemId);
    }

    function getUsageForItemFn(knowledgeItemId: string) {
      return getUsageForItem(snapshot.usage, knowledgeItemId);
    }

    function searchKnowledge(query: KnowledgeSearchQuery) {
      return searchKnowledgeItems(snapshot.items, query);
    }

    function getItemsForDomainFn(
      domain: KnowledgeItem["relatedDomains"][number]
    ) {
      return getItemsForDomain(snapshot.items, domain);
    }

    return {
      snapshot,
      loading,
      error,
      getKnowledgeItemById,
      getRelationshipsForItem: getRelationshipsForItemFn,
      getUsageForItem: getUsageForItemFn,
      searchKnowledge,
      getItemsForDomain: getItemsForDomainFn,
    };
  }, [snapshot, loading, error]);

  return (
    <CompanyBrainContext.Provider value={value}>
      {children}
    </CompanyBrainContext.Provider>
  );
}

export function useCompanyBrain() {
  const context = useContext(CompanyBrainContext);

  if (!context) {
    throw new Error(
      "useCompanyBrain must be used within a CompanyBrainProvider"
    );
  }

  return context;
}
