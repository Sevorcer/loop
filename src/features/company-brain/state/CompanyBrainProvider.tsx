"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { mockKnowledgeItems } from "../data/mockKnowledgeItems";
import { mockKnowledgeRelationships } from "../data/mockKnowledgeRelationships";
import { mockKnowledgeUsage } from "../data/mockKnowledgeUsage";
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
  getKnowledgeItemById: (id: string) => KnowledgeItem | undefined;
  getRelationshipsForItem: (knowledgeItemId: string) => KnowledgeRelationship[];
  getUsageForItem: (knowledgeItemId: string) => KnowledgeUsage[];
  searchKnowledge: (query: KnowledgeSearchQuery) => KnowledgeItem[];
  getItemsForDomain: (
    domain: KnowledgeItem["relatedDomains"][number]
  ) => KnowledgeItem[];
}

const CompanyBrainContext = createContext<CompanyBrainContextValue | null>(null);

export function CompanyBrainProvider({ children }: { children: ReactNode }) {
  const snapshot = useMemo(
    () =>
      assembleKnowledgeSnapshot(
        mockKnowledgeItems,
        mockKnowledgeRelationships,
        mockKnowledgeUsage
      ),
    []
  );

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
      getKnowledgeItemById,
      getRelationshipsForItem: getRelationshipsForItemFn,
      getUsageForItem: getUsageForItemFn,
      searchKnowledge,
      getItemsForDomain: getItemsForDomainFn,
    };
  }, [snapshot]);

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
