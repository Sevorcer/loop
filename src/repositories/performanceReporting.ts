import "server-only";

/**
 * Performance reporting repository — Sprint 27 #58/#59
 *
 * Reads performance_models and derives reporting records for the Copilot search.
 * Full KPI/scorecard/trend computation is derived from operational data at
 * query time — performance_models stores model definitions only.
 */

import type { PerformanceModel } from "@/features/reporting/types/reporting";

import { getRepositoryContext } from "./supabaseContext";

// ─── DB row shape ─────────────────────────────────────────────────────────────

interface PerformanceModelRow {
  id: string;
  org_id: string;
  title: string;
  description: string;
  owner: string;
  status: string;
  scope: string;
  related_domains: string[];
  default_comparison_window: string;
  health_scoring_rules: unknown;
  benchmark_config: unknown;
  created_at: string;
  updated_at: string;
}

function mapRow(row: PerformanceModelRow): PerformanceModel {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    status: row.status as PerformanceModel["status"],
    scope: row.scope as PerformanceModel["scope"],
    relatedDomains: row.related_domains,
    defaultComparisonWindow: row.default_comparison_window as PerformanceModel["defaultComparisonWindow"],
    healthScoringRules: (row.health_scoring_rules as PerformanceModel["healthScoringRules"]) ?? [],
    benchmarkConfig: (row.benchmark_config as PerformanceModel["benchmarkConfig"]) ?? {
      defaultType: "prior-period",
      priorPeriodDays: 30,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listPerformanceModels(filter?: {
  status?: PerformanceModel["status"];
}): Promise<PerformanceModel[]> {
  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("performance_models")
    .select(
      "id,org_id,title,description,owner,status,scope,related_domains,default_comparison_window,health_scoring_rules,benchmark_config,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filter?.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as PerformanceModelRow[]).map(mapRow);
}

export async function getPerformanceModelById(id: string): Promise<PerformanceModel | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("performance_models")
    .select(
      "id,org_id,title,description,owner,status,scope,related_domains,default_comparison_window,health_scoring_rules,benchmark_config,created_at,updated_at",
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapRow(data as PerformanceModelRow);
}
