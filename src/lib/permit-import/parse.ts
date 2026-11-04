/**
 * Permit-import CSV parsing and mapping logic.
 *
 * Reads Zowe's permit-tracker CSV and produces structured permit records
 * ready for database insertion. Matching to LOOP jobs is done at the
 * runner level (scripts/import-permits.ts) because it requires a database
 * connection; this module is pure parsing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single row parsed from the CSV. */
export interface PermitCsvRow {
  section: string;
  customerName: string;
  permitNo: string;
  installDate: string;
  electricalPermitDone: string;
  mechanicalFurnaceFinal: string;
  notes: string;
  confidence: string;
}

/** Status values matching the job_permits table permit_status enum. */
export type PermitStatus =
  | "applied"
  | "intake_scheduled"
  | "corrections_needed"
  | "resubmitted"
  | "waiting_on_city"
  | "issued";

/** A single parsed permit ready for matching/insertion. */
export interface ParsedPermit {
  /** Original CSV row index (1-based, header is row 1). */
  sourceRow: number;
  customerName: string;
  permitNumber: string;
  status: PermitStatus;
  installDate: Date | null;
  electricalPermitDone: string;
  mechanicalFurnaceFinal: string;
  notes: string;
  section: string;
  confidence: "high" | "low";
}

/** A row that needs no permit record (e.g. "NO PERMIT PER CITY"). */
export interface SkippedRow {
  sourceRow: number;
  customerName: string;
  reason: "no_permit_per_city" | "covered_under_building_permit" | "empty_customer_name";
  rawRow: PermitCsvRow;
}

/** A row flagged for review. */
export interface FlaggedRow {
  sourceRow: number;
  customerName: string;
  reason: "low_confidence" | "non_standard_permit_no";
  detail: string;
  rawRow: PermitCsvRow;
}

export interface ParseResult {
  permits: ParsedPermit[];
  skipped: SkippedRow[];
  flagged: FlaggedRow[];
}

/** The result of matching permits to LOOP jobs. */
export interface MatchedPermit extends ParsedPermit {
  matchType: "exact" | "partial";
  jobId: string;
  customerId: string;
  matchedCustomerName: string;
}

export interface UnmatchedPermit extends ParsedPermit {
  matchType: "unmatched";
}

export interface MatchResult {
  matched: MatchedPermit[];
  unmatched: UnmatchedPermit[];
  skipped: SkippedRow[];
  flagged: FlaggedRow[];
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a raw CSV string into PermitCsvRow objects.
 * Handles quoted fields with commas and newlines inside them.
 */
export function parseCsv(raw: string): PermitCsvRow[] {
  const lines = splitCsvLines(raw.trim());
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).map((fields) => ({
    section: (fields[0] ?? "").trim(),
    customerName: (fields[1] ?? "").trim(),
    permitNo: (fields[2] ?? "").trim(),
    installDate: (fields[3] ?? "").trim(),
    electricalPermitDone: (fields[4] ?? "").trim(),
    mechanicalFurnaceFinal: (fields[5] ?? "").trim(),
    notes: (fields[6] ?? "").trim(),
    confidence: (fields[7] ?? "").trim(),
  }));
}

/** Split CSV content into rows of fields, respecting quoted values. */
function splitCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(field);
      field = "";
    } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
      current.push(field);
      field = "";
      rows.push(current);
      current = [];
      if (ch === "\r") i += 1;
    } else if (ch === "\r") {
      current.push(field);
      field = "";
      rows.push(current);
      current = [];
    } else {
      field += ch;
    }
  }

  // Last field/row
  if (field || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Row classification and parsing
// ---------------------------------------------------------------------------

const NO_PERMIT_CITY_PATTERN = /\bNO PERMIT PER CITY\b/i;
const COVERED_BLDG_PATTERN = /\bNO PERMIT\b.*\bCOVERED UNDER\b.*\bPERMIT\b/i;

/** Detect rows that explicitly state no permit is needed. */
export function isNoPermitRow(row: PermitCsvRow): "no_permit_per_city" | "covered_under_building_permit" | null {
  const name = row.customerName.toUpperCase();
  if (NO_PERMIT_CITY_PATTERN.test(name)) return "no_permit_per_city";
  if (COVERED_BLDG_PATTERN.test(name)) return "covered_under_building_permit";
  return null;
}

/**
 * Split a permit_no field into individual permit numbers.
 * Handles "/" and "&" separators and strips whitespace.
 * Returns an empty array if no real permit numbers are present.
 */
export function splitPermitNumbers(raw: string): string[] {
  if (!raw) return [];

  // Filter out non-permit-number values
  const trimmed = raw.trim();
  if (isNonPermitNumber(trimmed)) return [];

  return trimmed
    .split(/[\/&]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isNonPermitNumber(s));
}

/** Detect values in the permit_no column that aren't actual permit numbers. */
function isNonPermitNumber(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.startsWith("waiting") ||
    lower.startsWith("checked") ||
    lower.includes("hear from") ||
    lower.includes("schedule")
  );
}

/**
 * Derive the permit status from the CSV row's columns.
 *
 * Rules:
 *   - "ALL PERMITS COMPLETED" or "PERMIT COMPLETED" or "COMPLETED" in notes → issued
 *   - Has permit_no and notes mention completed → issued
 *   - Has permit_no, no completion note → applied
 *   - No permit_no, no completion note → applied (permit pending)
 *   - "NOT DONE" in mechanical_furnace_final with completion in notes → issued
 *     (the permit itself is issued, only inspection is pending)
 *   - "EXPIRED" in mechanical → applied (needs re-application)
 */
export function deriveStatus(row: PermitCsvRow): PermitStatus {
  const notes = row.notes.toUpperCase();
  const mech = row.mechanicalFurnaceFinal.toUpperCase();

  // Explicit completion markers in notes
  if (
    notes.includes("ALL PERMITS COMPLETED") ||
    notes.includes("PERMIT COMPLETED") ||
    notes === "COMPLETED"
  ) {
    return "issued";
  }

  // "COMPLETED" as the full mechanical/furnace field also means done
  if (mech === "COMPLETED" || mech === "DONE") {
    return "issued";
  }

  // Notes contain "COMPLETED" in any form (e.g. "COMPLETED [Checked on Permit: ...]")
  if (notes.startsWith("COMPLETED")) {
    return "issued";
  }

  // EXPIRED means the permit lapsed
  if (mech.includes("EXPIRED")) {
    return "applied";
  }

  // Default: if there's a permit number, it's been applied for
  return "applied";
}

/**
 * Parse a US-format date string (M/D/YYYY) into a Date object.
 * Returns null for empty or unparseable strings.
 */
export function parseInstallDate(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;

  const trimmed = raw.trim();
  // Handle M/D/YYYY and MM/DD/YYYY
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  const year = parseInt(match[3]!, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null;

  const date = new Date(year, month - 1, day);
  // Verify it didn't overflow (e.g. Feb 31)
  if (date.getMonth() !== month - 1) return null;

  return date;
}

/**
 * Clean up the customer name for matching.
 * Removes "NO PERMIT" suffixes, trims whitespace.
 */
export function cleanCustomerName(raw: string): string {
  return raw
    .replace(/\s*NO PERMIT.*$/i, "")
    .replace(/\s*-\s*YUCK\s*/i, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse the full CSV into structured permits, skipped rows, and flagged rows.
 * Permit numbers that contain "/" or "&" are split into separate permits.
 */
export function parsePermitCsv(csvContent: string): ParseResult {
  const rows = parseCsv(csvContent);
  const permits: ParsedPermit[] = [];
  const skipped: SkippedRow[] = [];
  const flagged: FlaggedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const sourceRow = i + 2; // +2 for header row + 0-index
    // Flag low confidence rows FIRST: extraction trust is independent of
    // importability, so a row that will be skipped (e.g. blank customer
    // name) is still flagged for human review.
    const confidence = row.confidence.toLowerCase() === "low" ? "low" : "high";
    if (confidence === "low") {
      flagged.push({
        sourceRow,
        customerName: row.customerName,
        reason: "low_confidence",
        detail: `Row has low extraction confidence`,
        rawRow: row,
      });
    }
    
    // Skip empty customer names
    if (!row.customerName.trim()) {
      skipped.push({
        sourceRow,
        customerName: "(empty)",
        reason: "empty_customer_name",
        rawRow: row,
      });
      continue;
    }

    // Check for "NO PERMIT" rows
    const noPermitReason = isNoPermitRow(row);
    if (noPermitReason) {
      skipped.push({
        sourceRow,
        customerName: row.customerName,
        reason: noPermitReason,
        rawRow: row,
      });
      continue;
    }

    const status = deriveStatus(row);
    const installDate = parseInstallDate(row.installDate);
    const permitNumbers = splitPermitNumbers(row.permitNo);

    // Flag non-standard permit numbers
    if (row.permitNo && permitNumbers.length === 0) {
      flagged.push({
        sourceRow,
        customerName: row.customerName,
        reason: "non_standard_permit_no",
        detail: `Permit number field contains non-standard value: "${row.permitNo}"`,
        rawRow: row,
      });
    }

    const customerName = cleanCustomerName(row.customerName);

    if (permitNumbers.length === 0) {
      // One permit record with no number
      permits.push({
        sourceRow,
        customerName,
        permitNumber: "",
        status,
        installDate,
        electricalPermitDone: row.electricalPermitDone,
        mechanicalFurnaceFinal: row.mechanicalFurnaceFinal,
        notes: row.notes,
        section: row.section,
        confidence,
      });
    } else {
      // One permit record per permit number
      for (const permitNumber of permitNumbers) {
        permits.push({
          sourceRow,
          customerName,
          permitNumber,
          status,
          installDate,
          electricalPermitDone: row.electricalPermitDone,
          mechanicalFurnaceFinal: row.mechanicalFurnaceFinal,
          notes: row.notes,
          section: row.section,
          confidence,
        });
      }
    }
  }

  return { permits, skipped, flagged };
}

// ---------------------------------------------------------------------------
// Customer matching
// ---------------------------------------------------------------------------

export interface LoopCustomer {
  id: string;
  name: string;
}

export interface LoopJob {
  id: string;
  customerId: string;
  /** Property or site name, when available. */
  propertyName?: string;
  /** Additional identifying info (e.g. job number, address). */
  description?: string;
}

/**
 * Normalize a name for fuzzy matching: lowercase, collapse whitespace,
 * strip common suffixes/prefixes.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a CSV customer name against LOOP customers.
 *
 * Strategy:
 *   1. Exact match (normalized)
 *   2. The CSV name is "{Builder} {Property/Site}" — try matching the first
 *      word(s) against customer names and the rest against properties.
 *   3. Partial: CSV name contains or is contained by a customer name.
 *
 * Returns the best match or null.
 */
export function matchCustomer(
  csvName: string,
  customers: LoopCustomer[],
): { customer: LoopCustomer; matchType: "exact" | "partial" } | null {
  const normalCsv = normalizeName(csvName);
  if (!normalCsv) return null;

  // 1. Exact match
  for (const customer of customers) {
    if (normalizeName(customer.name) === normalCsv) {
      return { customer, matchType: "exact" };
    }
  }

  // 2. Partial — CSV name contains or is contained by customer name
  // Split CSV name: often "Builder Property" or "Builder - Property"
  const csvParts = csvName.split(/\s*[-–]\s*|\s+/).filter(Boolean);
  const csvFirst = csvParts[0] ? normalizeName(csvParts[0]) : "";

  // Check if the first part matches a customer
  if (csvFirst) {
    for (const customer of customers) {
      const normalCustomer = normalizeName(customer.name);
      if (normalCustomer === csvFirst) {
        return { customer, matchType: "partial" };
      }
    }
  }

  // 3. Containment match
  for (const customer of customers) {
    const normalCustomer = normalizeName(customer.name);
    if (!normalCustomer) continue;
    if (normalCsv.includes(normalCustomer) || normalCustomer.includes(normalCsv)) {
      return { customer, matchType: "partial" };
    }
  }

  return null;
}

/**
 * Given matched customers, pick the best job for each permit.
 * Without more info, returns the first job for the customer.
 */
export function matchPermitsToJobs(
  permits: ParsedPermit[],
  customers: LoopCustomer[],
  jobs: LoopJob[],
): MatchResult {
  const matched: MatchedPermit[] = [];
  const unmatched: UnmatchedPermit[] = [];
  const jobsByCustomer = new Map<string, LoopJob[]>();

  for (const job of jobs) {
    const existing = jobsByCustomer.get(job.customerId) ?? [];
    existing.push(job);
    jobsByCustomer.set(job.customerId, existing);
  }

  for (const permit of permits) {
    const customerMatch = matchCustomer(permit.customerName, customers);

    if (!customerMatch) {
      unmatched.push({ ...permit, matchType: "unmatched" });
      continue;
    }

    const customerJobs = jobsByCustomer.get(customerMatch.customer.id) ?? [];

    if (customerJobs.length === 0) {
      unmatched.push({ ...permit, matchType: "unmatched" });
      continue;
    }

    // Pick the best job — prefer one near the install date
    const job = pickBestJob(customerJobs, permit);

    matched.push({
      ...permit,
      matchType: customerMatch.matchType,
      jobId: job.id,
      customerId: customerMatch.customer.id,
      matchedCustomerName: customerMatch.customer.name,
    });
  }

  return { matched, unmatched, skipped: [], flagged: [] };
}

function pickBestJob(jobs: LoopJob[], _permit: ParsedPermit): LoopJob {
  // For now, return the first job. Future: compare install dates.
  return jobs[0]!;
}

// ---------------------------------------------------------------------------
// Import report
// ---------------------------------------------------------------------------

export interface ImportReport {
  totalCsvRows: number;
  totalPermitRecords: number;
  matched: number;
  unmatched: number;
  skipped: number;
  flagged: number;
  matchedDetails: Array<{
    customerName: string;
    permitNumber: string;
    status: PermitStatus;
    matchType: string;
    matchedCustomerName: string;
    jobId: string;
  }>;
  unmatchedDetails: Array<{
    sourceRow: number;
    customerName: string;
    permitNumber: string;
    status: PermitStatus;
  }>;
  skippedDetails: Array<{
    sourceRow: number;
    customerName: string;
    reason: string;
  }>;
  flaggedDetails: Array<{
    sourceRow: number;
    customerName: string;
    reason: string;
    detail: string;
  }>;
}

export function buildImportReport(
  parseResult: ParseResult,
  matchResult: MatchResult,
  totalCsvRows: number,
): ImportReport {
  return {
    totalCsvRows,
    totalPermitRecords: parseResult.permits.length,
    matched: matchResult.matched.length,
    unmatched: matchResult.unmatched.length,
    skipped: parseResult.skipped.length,
    flagged: parseResult.flagged.length,
    matchedDetails: matchResult.matched.map((m) => ({
      customerName: m.customerName,
      permitNumber: m.permitNumber,
      status: m.status,
      matchType: m.matchType,
      matchedCustomerName: m.matchedCustomerName,
      jobId: m.jobId,
    })),
    unmatchedDetails: matchResult.unmatched.map((u) => ({
      sourceRow: u.sourceRow,
      customerName: u.customerName,
      permitNumber: u.permitNumber,
      status: u.status,
    })),
    skippedDetails: parseResult.skipped.map((s) => ({
      sourceRow: s.sourceRow,
      customerName: s.customerName,
      reason: s.reason,
    })),
    flaggedDetails: parseResult.flagged.map((f) => ({
      sourceRow: f.sourceRow,
      customerName: f.customerName,
      reason: f.reason,
      detail: f.detail,
    })),
  };
}
