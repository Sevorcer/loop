import "server-only";

/**
 * Portal Job Data service — GC Portal v1 + v2
 *
 * Fetches scoped job data for the public GC portal. All data is strictly
 * scoped to a single job within an org. No internal notes or sensitive
 * personal data beyond crew first names is exposed.
 *
 * CRITICAL: When portal_money_visible is false, NO financial fields appear
 * in the response at all (omitted from JSON, not just hidden in the UI).
 * When portal_photos_visible is false, no photos appear.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Bucket used for job file uploads (photos and documents). */
export const JOB_FILES_BUCKET = "job-files";

// ─── Column name constants (used by pin tests) ──────────────────────────────

/** Columns selected from the `jobs` table. */
export const JOBS_SELECT_COLUMNS =
  "id, job_number, status, type, scheduled_for, property_id, customer_id, portal_money_visible, portal_photos_visible";

/** Columns selected from the `job_activity` table. */
export const JOB_ACTIVITY_SELECT_COLUMNS = "id, type, description, created_at";

/** The column used for activity type filtering on `job_activity`. */
export const JOB_ACTIVITY_TYPE_COLUMN = "type";

/** Table name for job crew assignments. */
export const JOB_ASSIGNEES_TABLE = "job_assignees";

/** Table name for file storage metadata. */
export const STORAGE_OBJECTS_TABLE = "storage_objects";

/** Columns selected from `storage_objects` for photos/documents. */
export const STORAGE_OBJECTS_SELECT_COLUMNS =
  "id, file_name, bucket, storage_path, mime_type, created_at";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortalJobData {
  id: string;
  jobNumber: string | null;
  status: string;
  type: string;
  scheduledDate: string | null;
  completedDate: string | null;
  propertyAddress: string | null;
  customerName: string | null;
  /** Crew first names only — no personal data beyond what's shown in-app */
  crewFirstNames: string[];
  /** Timeline events visible to portal */
  timeline: PortalTimelineEvent[];
  /** Photos visible to portal — only present when portal_photos_visible is true */
  photos: PortalPhoto[];
  /** Documents visible to portal */
  documents: PortalDocument[];
  /** Money fields — only present when portal_money_visible is true */
  money?: PortalMoneyData;
  /** Permits (non-voided) for the job */
  permits: PortalPermit[];
  /** Inspections for the job */
  inspections: PortalInspection[];
  /** Progress milestones derived from status-change activity */
  progressTimeline: PortalMilestone[];
  /** Estimate (current bid) — only present when portal_money_visible is true */
  estimate?: PortalEstimate;
  /** Billing snapshot — only present when portal_money_visible is true */
  billing?: PortalBilling;
  /** Change orders — title/status always present; amounts only when money visible */
  changeOrders: PortalChangeOrderV2[];
}

export interface PortalTimelineEvent {
  id: string;
  type: string;
  description: string;
  occurredAt: string;
}

export interface PortalPhoto {
  id: string;
  url: string;
  caption: string | null;
  uploadedAt: string;
}

export interface PortalDocument {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export interface PortalMoneyData {
  priceCents: number | null;
  changeOrders: PortalChangeOrder[];
  invoiceNumber: string | null;
  dateSent: string | null;
  dateReceived: string | null;
  balanceCents: number;
  retainerCents: number;
}

export interface PortalChangeOrder {
  id: string;
  changeOrderNumber: string;
  amountCents: number;
  description: string;
}

export interface PortalPermit {
  id: string;
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: string;
  appliedAt: string | null;
  issuedAt: string | null;
  documentUrl: string | null;
}

export interface PortalInspection {
  id: string;
  inspectionType: string;
  scheduledDate: string | null;
  result: string;
  resultDate: string | null;
  inspectorName: string | null;
  correctionsCount: number;
}

export interface PortalMilestone {
  label: string;
  date: string | null;
  reached: boolean;
}

export interface PortalEstimate {
  amountCents: number;
  status: string;
}

export interface PortalBilling {
  revenueCents: number | null;
  totalPaymentsCents: number;
  balanceCents: number;
}

export interface PortalChangeOrderV2 {
  id: string;
  title: string;
  status: string;
  /** Only present when portal_money_visible is true */
  amountCents?: number;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

/**
 * Derive completion date from job_activity — mirrors the pattern in
 * `src/repositories/billing.ts` -> `getJobCompletionDate()`.
 */
async function getCompletionTimestamp(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  jobId: string,
): Promise<string | null> {
  if (!admin) return null;

  const { data, error } = await admin
    .from("job_activity")
    .select("created_at")
    .eq("job_id", jobId)
    .eq(JOB_ACTIVITY_TYPE_COLUMN, "status")
    .ilike("description", "%to Completed%")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return null;
  const rows = data as Record<string, unknown>[] | null;
  return (rows?.[0]?.created_at as string) ?? null;
}

/**
 * Load all portal-visible data for a single job, scoped to the given org.
 * Uses admin client since this is accessed via public share links.
 */
export async function getPortalJobData(
  jobId: string,
  orgId: string,
): Promise<PortalJobData | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  // Load the job itself
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select(JOBS_SELECT_COLUMNS)
    .eq("id", jobId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (jobError || !job) return null;

  const jobRow = job as Record<string, unknown>;

  // Load property address
  let propertyAddress: string | null = null;
  if (jobRow.property_id) {
    const { data: property } = await admin
      .from("properties")
      .select("address")
      .eq("id", jobRow.property_id as string)
      .maybeSingle();
    propertyAddress = (property as Record<string, unknown> | null)?.address as string | null;
  }

  // Load customer name
  let customerName: string | null = null;
  if (jobRow.customer_id) {
    const { data: customer } = await admin
      .from("customers")
      .select("name")
      .eq("id", jobRow.customer_id as string)
      .maybeSingle();
    customerName = (customer as Record<string, unknown> | null)?.name as string | null;
  }

  // Load crew first names from job_assignees
  const crewFirstNames: string[] = [];
  const { data: assignments } = await admin
    .from(JOB_ASSIGNEES_TABLE)
    .select("user_id")
    .eq("job_id", jobId);

  if (assignments && Array.isArray(assignments)) {
    for (const assignment of assignments) {
      const a = assignment as Record<string, unknown>;
      if (a.user_id) {
        const { data: profile } = await admin
          .from("user_profiles")
          .select("full_name")
          .eq("id", a.user_id as string)
          .maybeSingle();
        if (profile) {
          const fullName = (profile as Record<string, unknown>).full_name as string | null;
          if (fullName) {
            const firstName = fullName.split(" ")[0];
            if (firstName) crewFirstNames.push(firstName);
          }
        }
      }
    }
  }

  // Load timeline (job_activity — excluding internal notes)
  const timeline: PortalTimelineEvent[] = [];
  const { data: activities } = await admin
    .from("job_activity")
    .select(JOB_ACTIVITY_SELECT_COLUMNS)
    .eq("job_id", jobId)
    .neq(JOB_ACTIVITY_TYPE_COLUMN, "internal_note")
    .order("created_at", { ascending: false })
    .limit(50);

  if (activities && Array.isArray(activities)) {
    for (const activity of activities) {
      const a = activity as Record<string, unknown>;
      timeline.push({
        id: a.id as string,
        type: a.type as string,
        description: a.description as string,
        occurredAt: a.created_at as string,
      });
    }
  }

  // Load photos from storage_objects — only when portal_photos_visible is true
  const photos: PortalPhoto[] = [];
  if (jobRow.portal_photos_visible === true) {
    const { data: photoRows } = await admin
      .from(STORAGE_OBJECTS_TABLE)
      .select(STORAGE_OBJECTS_SELECT_COLUMNS)
      .eq("job_id", jobId)
      .eq("bucket", JOB_FILES_BUCKET)
      .eq("visibility", "customer")
      .ilike("mime_type", "image/%")
      .order("created_at", { ascending: false });

    if (photoRows && Array.isArray(photoRows)) {
      for (const photo of photoRows) {
        const p = photo as Record<string, unknown>;
        photos.push({
          id: p.id as string,
          url: `/api/portal/files/${p.id as string}`,
          caption: null,
          uploadedAt: p.created_at as string,
        });
      }
    }
  }

  // Load documents from storage_objects (non-image job files)
  const documents: PortalDocument[] = [];
  const { data: docRows } = await admin
    .from(STORAGE_OBJECTS_TABLE)
    .select(STORAGE_OBJECTS_SELECT_COLUMNS)
    .eq("job_id", jobId)
    .eq("bucket", JOB_FILES_BUCKET)
    .eq("visibility", "customer")
    .not("mime_type", "ilike", "image/%")
    .order("created_at", { ascending: false });

  if (docRows && Array.isArray(docRows)) {
    for (const doc of docRows) {
      const d = doc as Record<string, unknown>;
      documents.push({
        id: d.id as string,
        name: d.file_name as string,
        url: `/api/portal/files/${d.id as string}`,
        uploadedAt: d.created_at as string,
      });
    }
  }

  // ── Permits (non-voided) ────────────────────────────────────────────────
  // Table: job_permits — columns verified against src/repositories/jobPermits.ts
  const permits: PortalPermit[] = [];
  const { data: permitRows } = await admin
    .from("job_permits")
    .select("id, jurisdiction, permit_type, permit_number, status, applied_at, issued_at, document_storage_id")
    .eq("job_id", jobId)
    .eq("org_id", orgId)
    .is("voided_at", null)
    .order("created_at", { ascending: true });

  if (permitRows && Array.isArray(permitRows)) {
    for (const row of permitRows) {
      const r = row as Record<string, unknown>;
      permits.push({
        id: r.id as string,
        jurisdiction: r.jurisdiction as string,
        permitType: r.permit_type as string,
        permitNumber: (r.permit_number as string | null) ?? null,
        status: r.status as string,
        appliedAt: (r.applied_at as string | null) ?? null,
        issuedAt: (r.issued_at as string | null) ?? null,
        documentUrl: r.document_storage_id
          ? `/api/portal/files/${r.document_storage_id as string}`
          : null,
      });
    }
  }

  // ── Inspections ─────────────────────────────────────────────────────────
  // Table: job_inspections — columns verified against src/repositories/jobInspections.ts
  const inspections: PortalInspection[] = [];
  const { data: inspectionRows } = await admin
    .from("job_inspections")
    .select("id, inspection_type, scheduled_date, result, result_date, inspector_name")
    .eq("job_id", jobId)
    .eq("org_id", orgId)
    .order("scheduled_date", { ascending: true });

  if (inspectionRows && Array.isArray(inspectionRows)) {
    for (const row of inspectionRows) {
      const r = row as Record<string, unknown>;
      // Count corrections for this inspection
      const { count } = await admin
        .from("inspection_corrections")
        .select("id", { count: "exact", head: true })
        .eq("inspection_id", r.id as string)
        .eq("org_id", orgId);

      inspections.push({
        id: r.id as string,
        inspectionType: r.inspection_type as string,
        scheduledDate: (r.scheduled_date as string | null) ?? null,
        result: r.result as string,
        resultDate: (r.result_date as string | null) ?? null,
        inspectorName: (r.inspector_name as string | null) ?? null,
        correctionsCount: count ?? 0,
      });
    }
  }

  // ── Progress Timeline (status milestones) ───────────────────────────────
  // Table: job_activity — type='status' entries ordered by created_at
  const progressTimeline: PortalMilestone[] = [];
  const { data: statusActivities } = await admin
    .from("job_activity")
    .select("description, created_at")
    .eq("job_id", jobId)
    .eq(JOB_ACTIVITY_TYPE_COLUMN, "status")
    .order("created_at", { ascending: true });

  // Build milestones: Scheduled -> In Progress -> Completed
  const milestoneStatuses = ["Scheduled", "In Progress", "Completed"] as const;
  const milestoneDates: Record<string, string | null> = {};
  if (statusActivities && Array.isArray(statusActivities)) {
    for (const row of statusActivities) {
      const r = row as Record<string, unknown>;
      const desc = r.description as string;
      for (const ms of milestoneStatuses) {
        if (desc.includes(`to ${ms}`)) {
          milestoneDates[ms] = r.created_at as string;
        }
      }
    }
  }
  for (const ms of milestoneStatuses) {
    progressTimeline.push({
      label: ms,
      date: milestoneDates[ms] ?? null,
      reached: milestoneDates[ms] != null,
    });
  }

  // ── Money-gated sections ────────────────────────────────────────────────
  const moneyVisible = jobRow.portal_money_visible === true;

  // Load money data only if the portal_money_visible flag is true
  let money: PortalMoneyData | undefined;
  let estimate: PortalEstimate | undefined;
  let billing: PortalBilling | undefined;

  if (moneyVisible) {
    // Legacy money (gc_ledger_entries)
    const { data: ledgerEntry } = await admin
      .from("gc_ledger_entries")
      .select("id, balance_cents, retainer_cents, date_sent, date_received")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .maybeSingle();

    // Load bid price
    let priceCents: number | null = null;
    const { data: bid } = await admin
      .from("job_bids")
      .select("amount_cents")
      .eq("job_id", jobId)
      .eq("is_current", true)
      .maybeSingle();
    if (bid) priceCents = (bid as Record<string, unknown>).amount_cents as number | null;

    // Load invoice number from jobs
    const invoiceNumber = (jobRow as Record<string, unknown>).qb_invoice_number as string | null ?? null;

    // Load change orders from gc_change_orders (legacy)
    const changeOrders: PortalChangeOrder[] = [];
    if (ledgerEntry) {
      const le = ledgerEntry as Record<string, unknown>;
      const { data: coRows } = await admin
        .from("gc_change_orders")
        .select("id, change_order_number, amount_cents, description")
        .eq("ledger_entry_id", le.id as string)
        .order("created_at", { ascending: true });

      if (coRows && Array.isArray(coRows)) {
        for (const co of coRows) {
          const c = co as Record<string, unknown>;
          changeOrders.push({
            id: c.id as string,
            changeOrderNumber: c.change_order_number as string,
            amountCents: c.amount_cents as number,
            description: c.description as string,
          });
        }
      }

      money = {
        priceCents,
        changeOrders,
        invoiceNumber,
        dateSent: le.date_sent as string | null,
        dateReceived: le.date_received as string | null,
        balanceCents: (le.balance_cents as number) ?? 0,
        retainerCents: (le.retainer_cents as number) ?? 0,
      };
    } else {
      // No ledger entry but flag is on — return empty money
      money = {
        priceCents,
        changeOrders: [],
        invoiceNumber,
        dateSent: null,
        dateReceived: null,
        balanceCents: 0,
        retainerCents: 0,
      };
    }

    // ── Estimate (current bid) ──────────────────────────────────────────
    // Table: job_bids — columns verified against src/repositories/jobBids.ts
    const { data: currentBid } = await admin
      .from("job_bids")
      .select("amount_cents, status")
      .eq("job_id", jobId)
      .eq("is_current", true)
      .maybeSingle();

    if (currentBid) {
      const b = currentBid as Record<string, unknown>;
      estimate = {
        amountCents: b.amount_cents as number,
        status: b.status as string,
      };
    }

    // ── Billing snapshot ────────────────────────────────────────────────
    // Table: job_financials — columns verified against src/repositories/jobPrice.ts
    // job_financials has: revenue_cents (bigint). For payments, use payments table.
    const { data: financialRow } = await admin
      .from("job_financials")
      .select("revenue_cents")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .maybeSingle();

    // Sum payments for this job
    const { data: paymentRows } = await admin
      .from("payments")
      .select("amount_cents")
      .eq("job_id", jobId)
      .eq("org_id", orgId);

    const revenueCents = financialRow
      ? ((financialRow as Record<string, unknown>).revenue_cents as number | null)
      : null;
    const totalPaymentsCents = (paymentRows ?? []).reduce(
      (sum: number, row: unknown) => sum + (((row as Record<string, unknown>).amount_cents as number) ?? 0),
      0,
    );
    const balanceCents = (revenueCents ?? 0) - totalPaymentsCents;

    billing = {
      revenueCents,
      totalPaymentsCents,
      balanceCents,
    };
  }

  // ── Change Orders (from job_change_orders table — PR #387) ────────────
  // Table may not exist yet; try/catch returns empty array on failure.
  // Columns verified against supabase/migrations/20261120900000_job_change_orders.sql:
  //   id, org_id, job_id, title, description, amount_cents, status, created_by, approved_at, created_at, updated_at
  const changeOrders: PortalChangeOrderV2[] = [];
  try {
    const { data: coRows, error: coError } = await admin
      .from("job_change_orders")
      .select("id, title, status, amount_cents")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (!coError && coRows && Array.isArray(coRows)) {
      for (const row of coRows) {
        const r = row as Record<string, unknown>;
        const co: PortalChangeOrderV2 = {
          id: r.id as string,
          title: r.title as string,
          status: r.status as string,
        };
        // Only include amount when money is visible
        if (moneyVisible) {
          co.amountCents = r.amount_cents as number;
        }
        changeOrders.push(co);
      }
    }
  } catch {
    // Table doesn't exist yet (PR #387 not merged) — return empty array
  }

  return {
    id: jobRow.id as string,
    jobNumber: jobRow.job_number as string | null,
    status: jobRow.status as string,
    type: jobRow.type as string,
    scheduledDate: jobRow.scheduled_for as string | null,
    completedDate: await getCompletionTimestamp(admin, jobId),
    propertyAddress,
    customerName,
    crewFirstNames,
    timeline,
    photos,
    documents,
    money,
    permits,
    inspections,
    progressTimeline,
    estimate,
    billing,
    changeOrders,
  };
}
