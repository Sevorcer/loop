import "server-only";

/**
 * Knowledge items service — Sprint 27 #58/#59
 *
 * Business logic for Company Brain knowledge management.
 * Replaces mockKnowledgeItems in production paths.
 */

import type {
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeSearchQuery,
  KnowledgeSnapshot,
  KnowledgeUsage,
  KnowledgeUsageEvent,
} from "@/features/company-brain/types/knowledgeItem";
import { assembleKnowledgeSnapshot, searchKnowledgeItems } from "@/features/company-brain/utils/knowledgeUtils";

import {
  getKnowledgeItemById,
  listKnowledgeItems,
  listKnowledgeRelationships,
  listKnowledgeUsage,
  recordKnowledgeUsage,
} from "@/repositories/knowledgeItems";

// ─── Snapshot — full Company Brain state for the UI ───────────────────────────

/**
 * Fetches all knowledge items, relationships, and usage in parallel and
 * assembles them into the canonical KnowledgeSnapshot consumed by the
 * CompanyBrainProvider.
 */
export async function getKnowledgeSnapshot(): Promise<KnowledgeSnapshot> {
  const [items, relationships, usage] = await Promise.all([
    listKnowledgeItems(),
    listKnowledgeRelationships(),
    listKnowledgeUsage(),
  ]);

  return assembleKnowledgeSnapshot(items, relationships, usage);
}

// ─── Individual operations ────────────────────────────────────────────────────

export async function getKnowledgeItems(filter?: {
  status?: KnowledgeItem["status"];
  knowledgeType?: KnowledgeItem["knowledgeType"];
}): Promise<KnowledgeItem[]> {
  return listKnowledgeItems(filter);
}

export async function getKnowledgeItem(id: string): Promise<KnowledgeItem | null> {
  return getKnowledgeItemById(id);
}

export async function getKnowledgeRelationships(itemId?: string): Promise<KnowledgeRelationship[]> {
  return listKnowledgeRelationships(itemId);
}

export async function getKnowledgeUsage(itemId?: string): Promise<KnowledgeUsage[]> {
  return listKnowledgeUsage(itemId);
}

export async function trackKnowledgeUsage(
  itemId: string,
  event: KnowledgeUsageEvent,
  context?: string,
): Promise<void> {
  return recordKnowledgeUsage(itemId, event, context);
}

export async function searchKnowledge(query: KnowledgeSearchQuery): Promise<KnowledgeItem[]> {
  const items = await listKnowledgeItems();
  return searchKnowledgeItems(items, query);
}
