import "server-only";

/**
 * Knowledge items repository — Sprint 27 #58/#59
 *
 * CRUD + search operations for knowledge_items, knowledge_relationships,
 * and knowledge_usage tables.  Replaces mockKnowledgeItems in production paths.
 */

import type {
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeUsage,
  KnowledgeStatus,
  KnowledgeType,
  KnowledgeUsageEvent,
} from "@/features/company-brain/types/knowledgeItem";

import { getRepositoryContext } from "./supabaseContext";

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface KnowledgeItemRow {
  id: string;
  org_id: string;
  title: string;
  summary: string;
  body: string;
  knowledge_type: KnowledgeType;
  status: KnowledgeStatus;
  version: number;
  tags: string[];
  owner: string;
  related_domains: string[];
  created_at: string;
  updated_at: string;
}

interface KnowledgeRelationshipRow {
  id: string;
  org_id: string;
  knowledge_item_id: string;
  related_domain: string;
  related_entity_id: string;
  related_entity_label: string;
  relationship_type: string;
  notes: string | null;
  created_at: string;
}

interface KnowledgeUsageRow {
  id: string;
  org_id: string;
  knowledge_item_id: string;
  event: KnowledgeUsageEvent;
  context: string | null;
  timestamp: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapItem(row: KnowledgeItemRow): KnowledgeItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    knowledgeType: row.knowledge_type,
    status: row.status,
    version: row.version,
    tags: row.tags,
    owner: row.owner,
    relatedDomains: row.related_domains as KnowledgeItem["relatedDomains"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRelationship(row: KnowledgeRelationshipRow): KnowledgeRelationship {
  return {
    id: row.id,
    knowledgeItemId: row.knowledge_item_id,
    relatedDomain: row.related_domain as KnowledgeRelationship["relatedDomain"],
    relatedEntityId: row.related_entity_id,
    relatedEntityLabel: row.related_entity_label,
    relationshipType: row.relationship_type as KnowledgeRelationship["relationshipType"],
    notes: row.notes ?? undefined,
  };
}

function mapUsage(row: KnowledgeUsageRow): KnowledgeUsage {
  return {
    id: row.id,
    knowledgeItemId: row.knowledge_item_id,
    event: row.event,
    context: row.context ?? undefined,
    timestamp: row.timestamp,
  };
}

// ─── Knowledge items ──────────────────────────────────────────────────────────

export async function listKnowledgeItems(
  filter?: {
    status?: KnowledgeStatus;
    knowledgeType?: KnowledgeType;
  },
  options?: { page?: number; pageSize?: number },
): Promise<KnowledgeItem[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("knowledge_items")
    .select(
      "id,org_id,title,summary,body,knowledge_type,status,version,tags,owner,related_domains,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.knowledgeType) query = query.eq("knowledge_type", filter.knowledgeType);

  query = query.range(from, to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as KnowledgeItemRow[]).map(mapItem);
}

export async function getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("knowledge_items")
    .select(
      "id,org_id,title,summary,body,knowledge_type,status,version,tags,owner,related_domains,created_at,updated_at",
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapItem(data as KnowledgeItemRow);
}

// ─── Relationships ────────────────────────────────────────────────────────────

export async function listKnowledgeRelationships(
  knowledgeItemId?: string,
  options?: { page?: number; pageSize?: number },
): Promise<KnowledgeRelationship[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("knowledge_relationships")
    .select(
      "id,org_id,knowledge_item_id,related_domain,related_entity_id,related_entity_label,relationship_type,notes,created_at",
    )
    .eq("org_id", orgId);

  if (knowledgeItemId) query = query.eq("knowledge_item_id", knowledgeItemId);

  query = query.range(from, to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as KnowledgeRelationshipRow[]).map(mapRelationship);
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export async function listKnowledgeUsage(
  knowledgeItemId?: string,
  options?: { page?: number; pageSize?: number },
): Promise<KnowledgeUsage[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("knowledge_usage")
    .select("id,org_id,knowledge_item_id,event,context,timestamp")
    .eq("org_id", orgId)
    .order("timestamp", { ascending: false })
    .limit(200);

  if (knowledgeItemId) query = query.eq("knowledge_item_id", knowledgeItemId);

  query = query.range(from, to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as KnowledgeUsageRow[]).map(mapUsage);
}

export async function recordKnowledgeUsage(
  knowledgeItemId: string,
  event: KnowledgeUsageEvent,
  context?: string,
): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase.from("knowledge_usage").insert({
    org_id: orgId,
    knowledge_item_id: knowledgeItemId,
    event,
    context: context ?? null,
  });

  if (error) throw new Error(error.message);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export type KnowledgeItemCreateInput = Omit<
  KnowledgeItem,
  "id" | "createdAt" | "updatedAt" | "version"
>;

export type KnowledgeItemUpdateInput = Partial<
  Omit<KnowledgeItem, "id" | "createdAt" | "updatedAt">
>;

export async function insertKnowledgeItem(
  input: KnowledgeItemCreateInput,
): Promise<KnowledgeItem> {
  const { supabase, orgId } = await getRepositoryContext();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({
      org_id: orgId,
      title: input.title,
      summary: input.summary,
      body: input.body,
      knowledge_type: input.knowledgeType,
      status: input.status,
      version: 1,
      tags: input.tags,
      owner: input.owner,
      related_domains: input.relatedDomains,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id,org_id,title,summary,body,knowledge_type,status,version,tags,owner,related_domains,created_at,updated_at",
    )
    .single();

  if (error) throw new Error(error.message);

  return mapItem(data as KnowledgeItemRow);
}

export async function updateKnowledgeItem(
  id: string,
  input: KnowledgeItemUpdateInput,
): Promise<KnowledgeItem | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.body !== undefined) patch.body = input.body;
  if (input.knowledgeType !== undefined) patch.knowledge_type = input.knowledgeType;
  if (input.status !== undefined) patch.status = input.status;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.owner !== undefined) patch.owner = input.owner;
  if (input.relatedDomains !== undefined) patch.related_domains = input.relatedDomains;
  if (input.version !== undefined) patch.version = input.version;

  const { data, error } = await supabase
    .from("knowledge_items")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select(
      "id,org_id,title,summary,body,knowledge_type,status,version,tags,owner,related_domains,created_at,updated_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapItem(data as KnowledgeItemRow);
}
