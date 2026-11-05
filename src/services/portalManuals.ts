import "server-only";

/**
 * Portal digital manuals — builder portal delivery (Collin's option b).
 *
 * GET /api/portal/[token]/manuals resolves the share token (same
 * `resolveShareToken` as GET /api/portal/[token]) and then calls
 * `getPortalJobManuals(jobId, orgId)` here.
 *
 * Source: the `equipment_manual_links_v` view (20261121500000). It already
 * limits rows to confirmed / auto-linked links to ACTIVE manuals in the
 * "Customer manuals" Drive folder (portal_eligible). Each URL is the Drive
 * web-view link; that folder is shared "anyone with the link", so builders
 * can open it without a Google account. Nothing is streamed or proxied.
 *
 * Scope — strictly the share link's job, in the link's org:
 *   1. systems whose job_id is the job,
 *   2. systems whose linked_workflow_ids contain the job,
 *   3. systems at the job's property, ONLY when every job at that property
 *      belongs to the same customer as this job (single-customer property).
 *      A property shared with another customer falls back to 1 + 2.
 * Every query also filters org_id, and rows are re-checked in code.
 * No customer names, notes, serials, or internal-only manuals are returned.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MANUAL_DOC_TYPE_LABELS, MANUAL_DOC_TYPES } from "@/features/manuals/types/manuals";
import type { ManualDocType } from "@/features/manuals/types/manuals";

export const EQUIPMENT_MANUAL_LINKS_VIEW = "equipment_manual_links_v";

/** Columns read from the view (pinned by tests). */
export const PORTAL_MANUAL_COLUMNS =
  "org_id, installed_system_id, property_id, job_id, system_name, manufacturer, model_number, location, manual_id, manual_name, doc_type, mime_type, web_view_link, link_status, updated_at";

const PORTAL_LINK_STATUSES = new Set(["confirmed", "auto_linked"]);
const MAX_ROWS = 500;
const MAX_PROPERTY_JOBS = 1000;

export interface PortalManual {
  id: string;
  name: string;
  docType: ManualDocType;
  docTypeLabel: string;
  mimeType: string;
  linkStatus: "confirmed" | "auto_linked";
  /** Drive web-view link (Customer manuals folder, anyone-with-the-link). */
  url: string;
  updatedAt: string;
}

export interface PortalManualSystem {
  id: string;
  systemName: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  location: string | null;
  manuals: PortalManual[];
}

export interface PortalJobManuals {
  jobId: string;
  systems: PortalManualSystem[];
}

interface ViewRow {
  org_id: string;
  installed_system_id: string;
  property_id: string | null;
  job_id: string | null;
  system_name: string | null;
  manufacturer: string | null;
  model_number: string | null;
  location: string | null;
  manual_id: string;
  manual_name: string;
  doc_type: string | null;
  mime_type: string | null;
  web_view_link: string | null;
  link_status: string;
  updated_at: string;
}

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

/** The view or column is missing (migration not applied yet): show no manuals. */
function isMissingRelation(error: { code?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703");
}

function isDocType(value: string | null): value is ManualDocType {
  return !!value && (MANUAL_DOC_TYPES as readonly string[]).includes(value);
}

function cleanText(value: string | null): string | null {
  const v = value?.trim();
  if (!v || /^unknown$/i.test(v)) return null;
  return v;
}

/** True when no job at the property belongs to a different customer. */
async function isSingleCustomerProperty(
  admin: AdminClient,
  orgId: string,
  propertyId: string,
  customerId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("jobs")
    .select("customer_id")
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .limit(MAX_PROPERTY_JOBS);
  if (error || !Array.isArray(data)) return false;
  if (data.length >= MAX_PROPERTY_JOBS) return false;
  return (data as Array<{ customer_id: string | null }>).every(
    (row) => row.customer_id === null || row.customer_id === customerId,
  );
}

export function groupPortalManualRows(rows: ViewRow[], orgId: string): PortalManualSystem[] {
  const systems = new Map<string, PortalManualSystem>();
  const seen = new Set<string>();
  for (const row of rows) {
    // Defence in depth: the view already filters these.
    if (row.org_id !== orgId) continue;
    if (!PORTAL_LINK_STATUSES.has(row.link_status)) continue;
    const url = row.web_view_link ?? "";
    if (!url.startsWith("https://")) continue;
    const key = `${row.installed_system_id}:${row.manual_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let system = systems.get(row.installed_system_id);
    if (!system) {
      system = {
        id: row.installed_system_id,
        systemName: cleanText(row.system_name),
        manufacturer: cleanText(row.manufacturer),
        modelNumber: cleanText(row.model_number),
        location: cleanText(row.location),
        manuals: [],
      };
      systems.set(row.installed_system_id, system);
    }
    const docType: ManualDocType = isDocType(row.doc_type) ? row.doc_type : "other";
    system.manuals.push({
      id: row.manual_id,
      name: row.manual_name,
      docType,
      docTypeLabel: MANUAL_DOC_TYPE_LABELS[docType],
      mimeType: row.mime_type ?? "",
      linkStatus: row.link_status as PortalManual["linkStatus"],
      url,
      updatedAt: row.updated_at,
    });
  }
  const out = [...systems.values()];
  for (const s of out) s.manuals.sort((a, b) => a.name.localeCompare(b.name));
  out.sort((a, b) => (a.systemName ?? "").localeCompare(b.systemName ?? "") || a.id.localeCompare(b.id));
  return out;
}

/**
 * Load the portal-visible manuals for one job, scoped to the given org.
 * Returns null when the job is not in the org (route answers 404).
 * Throws on unexpected database errors (route answers 500).
 */
export async function getPortalJobManuals(
  jobId: string,
  orgId: string,
): Promise<PortalJobManuals | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id, property_id, customer_id")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (jobError || !job) return null;
  const jobRow = job as { id: string; property_id: string | null; customer_id: string | null };

  const queries = [
    admin
      .from(EQUIPMENT_MANUAL_LINKS_VIEW)
      .select(PORTAL_MANUAL_COLUMNS)
      .eq("org_id", orgId)
      .eq("job_id", jobId)
      .limit(MAX_ROWS),
    admin
      .from(EQUIPMENT_MANUAL_LINKS_VIEW)
      .select(PORTAL_MANUAL_COLUMNS)
      .eq("org_id", orgId)
      .contains("linked_workflow_ids", [jobId])
      .limit(MAX_ROWS),
  ];

  if (
    jobRow.property_id &&
    jobRow.customer_id &&
    (await isSingleCustomerProperty(admin, orgId, jobRow.property_id, jobRow.customer_id))
  ) {
    queries.push(
      admin
        .from(EQUIPMENT_MANUAL_LINKS_VIEW)
        .select(PORTAL_MANUAL_COLUMNS)
        .eq("org_id", orgId)
        .eq("property_id", jobRow.property_id)
        .limit(MAX_ROWS),
    );
  }

  const rows: ViewRow[] = [];
  for (const query of queries) {
    const { data, error } = await query;
    if (isMissingRelation(error)) return { jobId, systems: [] };
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ViewRow[]));
  }

  return { jobId, systems: groupPortalManualRows(rows, orgId) };
}
