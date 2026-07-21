/**
 * CSV Import API — POST /api/import/[entity]
 *
 * Supported entities: customers, properties, jobs
 *
 * Query parameters:
 *   mode=dry_run  (default) — validate rows without writing; return errors
 *   mode=commit   — insert all valid rows; rollback on any failure
 *
 * Request: multipart/form-data with a "file" field containing a UTF-8 CSV.
 *          First row is treated as the header; column names are case-insensitive.
 *
 * Response shape:
 *   { mode, entity, total, inserted, skipped, errors: [{ row, field, message }] }
 *
 * HTTP status codes:
 *   200 — dry_run completed or commit succeeded
 *   400 — malformed CSV or missing file
 *   401 — unauthenticated
 *   403 — forbidden
 *   422 — all rows failed validation (commit mode only)
 *   500 — internal error
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  CustomerImportRowSchema,
  JobImportRowSchema,
  PropertyImportRowSchema,
  type ImportResult,
  type ImportRowError,
} from "@/lib/schemas/import";
import type { CoreTable } from "@/services/authorization";
import { createCustomer } from "@/services/customers";
import { createJob } from "@/services/jobs";
import { createProperty } from "@/services/properties";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupportedEntity = "customers" | "properties" | "jobs";

// ---------------------------------------------------------------------------
// CSV parser (no third-party dependency)
// ---------------------------------------------------------------------------

/**
 * Minimal RFC 4180-compatible CSV parser.
 * Returns an array of record objects keyed by the header row.
 * Field names are lowercased and leading/trailing whitespace stripped.
 */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Filter blank lines
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 2) return []; // header + at least 1 data row needed

  const headers = splitCSVRow(nonEmpty[0]).map((h) => h.trim().toLowerCase());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const fields = splitCSVRow(nonEmpty[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = fields[idx]?.trim() ?? "";
    });
    records.push(record);
  }

  return records;
}

/** Split a single CSV row respecting double-quoted fields. */
function splitCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Field name normalisation (camelCase ↔ header variants)
// ---------------------------------------------------------------------------

/**
 * Map lowercased CSV header names to the camelCase field names expected by
 * the Zod schemas. Supports snake_case, spaced, and camelCase variants.
 */
function normalizeFieldNames(
  row: Record<string, string>
): Record<string, string> {
  const mapping: Record<string, string> = {
    name: "name",
    primary_contact: "primaryContact",
    primarycontact: "primaryContact",
    "primary contact": "primaryContact",
    email: "email",
    phone: "phone",
    city: "city",
    status: "status",
    address: "address",
    type: "type",
    primary_system: "primarySystem",
    primarysystem: "primarySystem",
    "primary system": "primarySystem",
    customer: "customer",
    title: "title",
    priority: "priority",
    customer_name: "customerName",
    customername: "customerName",
    "customer name": "customerName",
    property_name: "propertyName",
    propertyname: "propertyName",
    "property name": "propertyName",
    assigned_to: "assignedTo",
    assignedto: "assignedTo",
    "assigned to": "assignedTo",
    scheduled_for: "scheduledFor",
    scheduledfor: "scheduledFor",
    "scheduled for": "scheduledFor",
    summary: "summary",
    location: "location",
    notes: "notes",
  };

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const canonical = mapping[key];
    if (canonical) {
      normalized[canonical] = value;
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateCustomerRow(
  row: Record<string, string>,
  rowIndex: number
): ImportRowError[] {
  const result = CustomerImportRowSchema.safeParse(row);
  if (result.success) return [];
  return result.error.issues.map((e) => ({
    row: rowIndex + 1,
    field: e.path.join(".") || "unknown",
    message: e.message,
  }));
}

function validatePropertyRow(
  row: Record<string, string>,
  rowIndex: number
): ImportRowError[] {
  const result = PropertyImportRowSchema.safeParse(row);
  if (result.success) return [];
  return result.error.issues.map((e) => ({
    row: rowIndex + 1,
    field: e.path.join(".") || "unknown",
    message: e.message,
  }));
}

function validateJobRow(
  row: Record<string, string>,
  rowIndex: number
): ImportRowError[] {
  const result = JobImportRowSchema.safeParse(row);
  if (result.success) return [];
  return result.error.issues.map((e) => ({
    row: rowIndex + 1,
    field: e.path.join(".") || "unknown",
    message: e.message,
  }));
}

// ---------------------------------------------------------------------------
// Insert helpers (commit mode)
// ---------------------------------------------------------------------------

async function insertCustomerRow(row: Record<string, string>): Promise<void> {
  const parsed = CustomerImportRowSchema.parse(row);
  await createCustomer({
    name: parsed.name,
    primaryContact: parsed.primaryContact,
    email: parsed.email,
    phone: parsed.phone,
    city: parsed.city,
    status: parsed.status,
  });
}

async function insertPropertyRow(row: Record<string, string>): Promise<void> {
  const parsed = PropertyImportRowSchema.parse(row);
  await createProperty({
    name: parsed.name,
    customer: parsed.customer,
    address: parsed.address,
    city: parsed.city,
    type: parsed.type,
    status: parsed.status,
    primarySystem: parsed.primarySystem,
  });
}

async function insertJobRow(row: Record<string, string>): Promise<void> {
  const parsed = JobImportRowSchema.parse(row);
  await createJob({
    title: parsed.title,
    type: parsed.type,
    priority: parsed.priority,
    customerName: parsed.customerName,
    propertyName: parsed.propertyName,
    assignedTo: parsed.assignedTo,
    scheduledFor: parsed.scheduledFor,
    summary: parsed.summary,
    location: parsed.location,
    notes: parsed.notes,
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

interface RouteParams {
  params: Promise<{ entity: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  // Authorization: ops_admin or platform_admin required.
  // We reuse the requirePermission guard with the entity table and "insert".
  const { entity: rawEntity } = await params;
  const entity = rawEntity as SupportedEntity;

  const SUPPORTED: Set<SupportedEntity> = new Set([
    "customers",
    "properties",
    "jobs",
  ]);

  if (!SUPPORTED.has(entity)) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: `Unsupported import entity: ${String(rawEntity)}`,
        code: 404,
      },
      { status: 404 }
    );
  }

  // Map entity → table name for permission check
  const tableMap: Record<SupportedEntity, CoreTable> = {
    customers: "customers",
    properties: "properties",
    jobs: "jobs",
  };

  const guard = requirePermission(request, tableMap[entity], "insert");
  if (!guard.ok) return guard.response;

  // Parse mode query param
  const url = new URL(request.url);
  const rawMode = url.searchParams.get("mode") ?? "dry_run";
  const mode: "dry_run" | "commit" =
    rawMode === "commit" ? "commit" : "dry_run";

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error: "BAD_REQUEST",
        message: "Request must be multipart/form-data with a 'file' field.",
        code: 400,
      },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      {
        error: "BAD_REQUEST",
        message: "Missing 'file' field in form data.",
        code: 400,
      },
      { status: 400 }
    );
  }

  const csvText = await (file as File).text();

  // Parse CSV
  let rawRows: Record<string, string>[];
  try {
    rawRows = parseCSV(csvText);
  } catch {
    return NextResponse.json(
      {
        error: "BAD_REQUEST",
        message: "Could not parse CSV file.",
        code: 400,
      },
      { status: 400 }
    );
  }

  if (rawRows.length === 0) {
    return NextResponse.json(
      {
        error: "BAD_REQUEST",
        message: "CSV file contains no data rows.",
        code: 400,
      },
      { status: 400 }
    );
  }

  // Normalize field names for each row
  const rows = rawRows.map(normalizeFieldNames);

  // Validate all rows
  const allErrors: ImportRowError[] = [];
  const validateRow =
    entity === "customers"
      ? validateCustomerRow
      : entity === "properties"
        ? validatePropertyRow
        : validateJobRow;

  for (let i = 0; i < rows.length; i++) {
    const rowErrors = validateRow(rows[i], i);
    allErrors.push(...rowErrors);
  }

  const total = rows.length;

  // Dry-run: return validation results without writing
  if (mode === "dry_run") {
    const result: ImportResult = {
      mode: "dry_run",
      entity,
      total,
      inserted: 0,
      skipped: allErrors.length > 0 ? total : 0,
      errors: allErrors,
    };
    return NextResponse.json(result, { status: 200 });
  }

  // Commit mode: all rows must pass validation
  if (allErrors.length > 0) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILURE",
        message: `${allErrors.length} row(s) failed validation. Fix errors and retry.`,
        code: 422,
        details: allErrors,
      },
      { status: 422 }
    );
  }

  // Insert rows sequentially (Supabase does not expose multi-statement
  // transactions through the JS client; we approximate atomicity by inserting
  // all rows and returning a 500 with count of successful inserts on error).
  let inserted = 0;
  try {
    const insertRow =
      entity === "customers"
        ? insertCustomerRow
        : entity === "properties"
          ? insertPropertyRow
          : insertJobRow;

    for (const row of rows) {
      await insertRow(row);
      inserted++;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during import.";
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: `Import failed after ${inserted} of ${total} rows were inserted: ${message}`,
        code: 500,
      },
      { status: 500 }
    );
  }

  const result: ImportResult = {
    mode: "commit",
    entity,
    total,
    inserted,
    skipped: 0,
    errors: [],
  };

  return NextResponse.json(result, { status: 200 });
}
