import "server-only";

import type {
  KnowledgeItemInput,
  KnowledgeLinkInput,
  TechnicalProfileInput,
  TechnicalSystemInput,
} from "@/features/job-materials/utils/technicalData";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Technical data for one job (#23). Reads only — sources, all verified against
// the live schema on 2026-11-04:
//   jobs (id, property_id)                              — RLS-scoped (tech: assigned only)
//   installed_systems (job_id | linked_workflow_ids | property_id)
//   technical_profiles (permit_fields, known_facts, discovered_facts)
//   knowledge_items (tags, title)  + knowledge_relationships  = Company Brain
// ---------------------------------------------------------------------------

const ID_CHUNK = 80;
const SYSTEM_PAGE = 200;
/** A property tops out at 49 systems live; this is a runaway guard. */
const SYSTEM_CAP = 1000;

const SYSTEM_COLUMNS =
  "id,system_name,manufacturer,model_number,serial_numbers,location,install_date,job_id,linked_workflow_ids,technical_profile_id,property_id,attributes,created_at";

interface SystemRow {
  id: string;
  system_name: string;
  manufacturer: string | null;
  model_number: string | null;
  serial_numbers: string[] | null;
  location: string | null;
  install_date: string | null;
  job_id: string | null;
  linked_workflow_ids: string[] | null;
  technical_profile_id: string | null;
  property_id: string | null;
  attributes: unknown;
}

function chunk<T>(values: ReadonlyArray<T>, size = ID_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/** Returns null when the job does not exist or the caller cannot see it (RLS). */
export async function loadJobTechnicalAnchor(
  jobId: string,
): Promise<{ id: string; propertyId: string | null } | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select("id,property_id")
    .eq("org_id", orgId)
    .eq("id", jobId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; property_id: string | null };
  return { id: row.id, propertyId: row.property_id ?? null };
}

/**
 * Systems on this job (job_id or linked_workflow_ids) plus everything already
 * recorded at the job's property — live, no system carries a job link yet
 * (0 of 2,778), so the property is what actually populates the panel.
 * `jobId` and `propertyId` are validated UUIDs before they reach this filter.
 */
export async function listTechnicalSystemsForJob(
  jobId: string,
  propertyId: string | null,
): Promise<TechnicalSystemInput[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const clauses = [`job_id.eq.${jobId}`, `linked_workflow_ids.cs.{${jobId}}`];
  if (propertyId) clauses.push(`property_id.eq.${propertyId}`);

  const rows: SystemRow[] = [];
  for (let from = 0; from < SYSTEM_CAP; from += SYSTEM_PAGE) {
    const { data, error } = await supabase
      .from("installed_systems")
      .select(SYSTEM_COLUMNS)
      .eq("org_id", orgId)
      .or(clauses.join(","))
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + SYSTEM_PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as SystemRow[];
    rows.push(...page);
    if (page.length < SYSTEM_PAGE) break;
  }

  return rows.map((row) => ({
    id: row.id,
    systemName: row.system_name,
    manufacturer: row.manufacturer ?? "",
    modelNumber: row.model_number ?? "",
    serialNumbers: row.serial_numbers ?? [],
    location: row.location ?? "",
    installDate: row.install_date ?? "",
    jobId: row.job_id,
    linkedWorkflowIds: row.linked_workflow_ids ?? [],
    technicalProfileId: row.technical_profile_id,
    attributes: row.attributes,
  }));
}

export async function listTechnicalProfilesByIds(
  ids: ReadonlyArray<string>,
): Promise<TechnicalProfileInput[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();
  const pages = await Promise.all(
    chunk(unique).map(async (part) => {
      const { data, error } = await supabase
        .from("technical_profiles")
        .select("id,equipment_type,permit_fields,known_facts,discovered_facts")
        .eq("org_id", orgId)
        .in("id", part);
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{
        id: string;
        equipment_type: string;
        permit_fields: unknown;
        known_facts: unknown;
        discovered_facts: unknown;
      }>;
    }),
  );
  return pages.flat().map((row) => ({
    id: row.id,
    equipmentType: row.equipment_type,
    permitFields: row.permit_fields,
    knownFacts: row.known_facts,
    discoveredFacts: row.discovered_facts,
  }));
}

interface KnowledgeRow {
  id: string;
  title: string;
  status: string;
  knowledge_type: string;
  tags: string[] | null;
}

/**
 * Company Brain candidates: items tagged with a manufacturer/model, items whose
 * title contains a model number, and items explicitly linked to these systems
 * or this job through knowledge_relationships. The builder decides which
 * system each one belongs to. Archived items are skipped.
 */
export async function listKnowledgeForEquipment(input: {
  jobId: string;
  systemIds: ReadonlyArray<string>;
  tags: ReadonlyArray<string>;
  titleModels: ReadonlyArray<string>;
}): Promise<{ items: KnowledgeItemInput[]; links: KnowledgeLinkInput[] }> {
  const { supabase, orgId } = await getRepositoryContext();
  const columns = "id,title,status,knowledge_type,tags";

  const tagQuery = input.tags.length
    ? supabase
        .from("knowledge_items")
        .select(columns)
        .eq("org_id", orgId)
        .neq("status", "archived")
        .overlaps("tags", [...input.tags])
        .limit(100)
    : null;

  // titleModels are pre-sanitized to [A-Za-z0-9-] (knowledgeSearchTokens).
  const titleQuery = input.titleModels.length
    ? supabase
        .from("knowledge_items")
        .select(columns)
        .eq("org_id", orgId)
        .neq("status", "archived")
        .or(input.titleModels.map((model) => `title.ilike.*${model}*`).join(","))
        .limit(100)
    : null;

  const entityIds = [...new Set([input.jobId, ...input.systemIds])];
  const linkQueries = chunk(entityIds).map((part) =>
    supabase
      .from("knowledge_relationships")
      .select("knowledge_item_id,related_entity_id")
      .eq("org_id", orgId)
      .in("related_domain", ["installed_systems", "equipment", "jobs"])
      .in("related_entity_id", part)
      .limit(500),
  );

  const [tagResult, titleResult, ...linkResults] = await Promise.all([
    tagQuery ?? Promise.resolve({ data: [], error: null }),
    titleQuery ?? Promise.resolve({ data: [], error: null }),
    ...linkQueries,
  ]);

  for (const result of [tagResult, titleResult, ...linkResults]) {
    if (result.error) throw new Error(result.error.message);
  }

  const links: KnowledgeLinkInput[] = linkResults.flatMap((result) =>
    ((result.data ?? []) as Array<{ knowledge_item_id: string; related_entity_id: string }>).map(
      (row) => ({ knowledgeItemId: row.knowledge_item_id, relatedEntityId: row.related_entity_id }),
    ),
  );

  const byId = new Map<string, KnowledgeRow>();
  for (const row of [
    ...((tagResult.data ?? []) as KnowledgeRow[]),
    ...((titleResult.data ?? []) as KnowledgeRow[]),
  ]) {
    byId.set(row.id, row);
  }

  const missingLinked = [...new Set(links.map((link) => link.knowledgeItemId))].filter(
    (id) => !byId.has(id),
  );
  if (missingLinked.length) {
    const pages = await Promise.all(
      chunk(missingLinked).map(async (part) => {
        const { data, error } = await supabase
          .from("knowledge_items")
          .select(columns)
          .eq("org_id", orgId)
          .neq("status", "archived")
          .in("id", part);
        if (error) throw new Error(error.message);
        return (data ?? []) as KnowledgeRow[];
      }),
    );
    for (const row of pages.flat()) byId.set(row.id, row);
  }

  return {
    items: [...byId.values()].map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      knowledgeType: row.knowledge_type,
      tags: row.tags ?? [],
    })),
    links,
  };
}

/**
 * Dispatch board: how many systems (and how many with a technical profile)
 * sit at each property. One read per 80 property ids, in parallel.
 */
export async function countSystemsForProperties(
  propertyIds: ReadonlyArray<string>,
): Promise<Record<string, { systems: number; withProfile: number }>> {
  const unique = [...new Set(propertyIds.filter(Boolean))];
  const result: Record<string, { systems: number; withProfile: number }> = {};
  for (const id of unique) result[id] = { systems: 0, withProfile: 0 };
  if (unique.length === 0) return result;

  const { supabase, orgId } = await getRepositoryContext();
  await Promise.all(
    chunk(unique).map(async (part) => {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("installed_systems")
          .select("id,property_id,technical_profile_id")
          .eq("org_id", orgId)
          .in("property_id", part)
          .order("id", { ascending: true })
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as Array<{
          property_id: string | null;
          technical_profile_id: string | null;
        }>;
        for (const row of page) {
          if (!row.property_id || !result[row.property_id]) continue;
          result[row.property_id].systems += 1;
          if (row.technical_profile_id) result[row.property_id].withProfile += 1;
        }
        if (page.length < 1000) break;
      }
    }),
  );
  return result;
}
