import "server-only";

/**
 * Portal Job Data service — GC Portal Tasks 1-3
 *
 * Fetches scoped job data for the public GC portal. All data is strictly
 * scoped to a single job within an org. No internal notes or sensitive
 * personal data beyond crew first names is exposed.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Bucket used for job file uploads (photos and documents). */
export const JOB_FILES_BUCKET = "job-files";

// ─── Column name constants (used by pin tests) ──────────────────────────────

/** Columns selected from the `jobs` table. */
export const JOBS_SELECT_COLUMNS =
  "id, job_number, status, type, scheduled_for, property_id, customer_id, portal_money_visible";

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
  /** Photos visible to portal */
  photos: PortalPhoto[];
  /** Documents visible to portal */
  documents: PortalDocument[];
  /** Money fields — only present when portal_money_visible is true */
  money?: PortalMoneyData;
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

  // Load photos from storage_objects (job files where mime_type is an image)
  const photos: PortalPhoto[] = [];
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

  // Load money data only if the portal_money_visible flag is true
  let money: PortalMoneyData | undefined;
  if (jobRow.portal_money_visible === true) {
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

    // Load change orders
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
  }

  return {
    id: jobRow.id as string,
    jobNumber: jobRow.job_number as string | null,
    status: jobRow.status as string,
    type: jobRow.type as string,
    scheduledDate: jobRow.scheduled_for as string | null,
    completedDate,
    propertyAddress,
    customerName,
    crewFirstNames,
    timeline,
    photos,
    documents,
    money,
  };
}
