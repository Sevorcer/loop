"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSnapshot() {
      try {
        const res = await fetch("/api/knowledge-items", {
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          // Non-2xx: leave empty snapshot in place (graceful degradation)
          return;
        }

        const json = (await res.json()) as { snapshot?: KnowledgeSnapshot };

        if (!cancelled && json.snapshot) {
          setSnapshot(json.snapshot);
        }
      } catch {
        // Network error — leave empty snapshot in place
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

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
      getKnowledgeItemById,
      getRelationshipsForItem: getRelationshipsForItemFn,
      getUsageForItem: getUsageForItemFn,
      searchKnowledge,
      getItemsForDomain: getItemsForDomainFn,
    };
  }, [snapshot, loading]);

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
