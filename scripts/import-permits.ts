/**
 * CLI runner for Zowe's permit tracker CSV import.
 *
 * Usage:
 *   npx tsx scripts/import-permits.ts path/to/permit-tracker.csv [--dry-run] [--json]
 *
 * Options:
 *   --dry-run   Parse and match only; do not write to the database.
 *   --json      Output the report as JSON instead of human-readable text.
 *
 * A real import requires DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * The job_permits migration (20261104000001_job_permits.sql) must be applied first.
 */

import { readFile } from "node:fs/promises";

import {
  buildImportReport,
  matchPermitsToJobs,
  parsePermitCsv,
  type ImportReport,
  type LoopCustomer,
  type LoopJob,
  type MatchResult,
  type ParseResult,
} from "../src/lib/permit-import/parse";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  csvPath: string;
  dryRun: boolean;
  json: boolean;
  help: boolean;
}

const HELP = `Import Zowe's permit tracker CSV into LOOP.

  npx tsx scripts/import-permits.ts <csv-file> [--dry-run] [--json]

Options:
  --dry-run   Parse and match without writing. Prints what would happen.
  --json      Output report as JSON.
  --help      Show this message.

A real import needs DATABASE_URL, or SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY.
Apply supabase/migrations/20261104000001_job_permits.sql before a real import.
`;

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { csvPath: "", dryRun: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else if (!args.csvPath) args.csvPath = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Database helpers (only used for real imports)
// ---------------------------------------------------------------------------

function databaseAvailable(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.LOOP_DB_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      ((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

async function loadCustomersFromDb(): Promise<LoopCustomer[]> {
  // Dynamic import to avoid requiring pg at parse time
  const pg = await import("pg");
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.LOOP_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    "";
  if (!connectionString) {
    throw new Error("Direct database connection required. Set DATABASE_URL.");
  }
  const client = new pg.default.Client({
    connectionString,
    application_name: "loop-permit-import",
  });
  await client.connect();
  try {
    const result = await client.query<{ id: string; name: string }>(
      "SELECT id::text, name FROM public.customers WHERE deleted_at IS NULL ORDER BY name",
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

async function loadJobsFromDb(): Promise<LoopJob[]> {
  const pg = await import("pg");
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.LOOP_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    "";
  const client = new pg.default.Client({
    connectionString,
    application_name: "loop-permit-import",
  });
  await client.connect();
  try {
    const result = await client.query<{
      id: string;
      customer_id: string;
      description: string;
    }>(
      "SELECT id::text, customer_id::text, COALESCE(description, '') as description FROM public.jobs WHERE deleted_at IS NULL ORDER BY created_at DESC",
    );
    return result.rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      description: r.description,
    }));
  } finally {
    await client.end();
  }
}

async function writePermitsToDb(
  matchResult: MatchResult,
): Promise<{ written: number; errors: string[] }> {
  const pg = await import("pg");
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.LOOP_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    "";
  const client = new pg.default.Client({
    connectionString,
    application_name: "loop-permit-import",
  });
  await client.connect();
  let written = 0;
  const errors: string[] = [];

  try {
    for (const permit of matchResult.matched) {
      try {
        await client.query(
          `INSERT INTO public.job_permits (
            job_id, org_id, jurisdiction, permit_type, permit_number,
            status, applied_at, notes
          )
          SELECT $1, j.org_id, '', '', $2,
                 $3::public.permit_status, $4, $5
          FROM public.jobs j WHERE j.id = $1`,
          [
            permit.jobId,
            permit.permitNumber || null,
            permit.status,
            permit.installDate?.toISOString() ?? null,
            permit.notes || null,
          ],
        );
        written += 1;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error";
        errors.push(
          `Row ${permit.sourceRow} (${permit.customerName}): ${msg}`,
        );
      }
    }
  } finally {
    await client.end();
  }

  return { written, errors };
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function formatReport(report: ImportReport, mode: string): string {
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push(`Permit Import Report (${mode})`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Total CSV rows:      ${report.totalCsvRows}`);
  lines.push(`Permit records:      ${report.totalPermitRecords}`);
  lines.push(`Matched to jobs:     ${report.matched}`);
  lines.push(`Unmatched:           ${report.unmatched}`);
  lines.push(`Skipped (no permit): ${report.skipped}`);
  lines.push(`Flagged for review:  ${report.flagged}`);
  lines.push("");

  if (report.skippedDetails.length > 0) {
    lines.push("-".repeat(40));
    lines.push("SKIPPED ROWS (no permit needed):");
    for (const s of report.skippedDetails) {
      lines.push(`  Row ${s.sourceRow}: ${s.customerName} — ${s.reason}`);
    }
    lines.push("");
  }

  if (report.flaggedDetails.length > 0) {
    lines.push("-".repeat(40));
    lines.push("FLAGGED FOR REVIEW:");
    for (const f of report.flaggedDetails) {
      lines.push(`  Row ${f.sourceRow}: ${f.customerName} — ${f.reason}: ${f.detail}`);
    }
    lines.push("");
  }

  if (report.unmatchedDetails.length > 0) {
    lines.push("-".repeat(40));
    lines.push("UNMATCHED (could not find job):");
    for (const u of report.unmatchedDetails) {
      lines.push(
        `  Row ${u.sourceRow}: ${u.customerName}${u.permitNumber ? ` [${u.permitNumber}]` : ""} — ${u.status}`,
      );
    }
    lines.push("");
  }

  if (report.matchedDetails.length > 0) {
    lines.push("-".repeat(40));
    lines.push("MATCHED:");
    for (const m of report.matchedDetails) {
      lines.push(
        `  ${m.customerName}${m.permitNumber ? ` [${m.permitNumber}]` : ""} → ${m.matchedCustomerName} (${m.matchType}) → job ${m.jobId} — ${m.status}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  if (!args.csvPath) {
    process.stderr.write("Provide a CSV file path.\n\n");
    process.stderr.write(HELP);
    process.exitCode = 1;
    return;
  }

  // Read and parse CSV
  const csvContent = await readFile(args.csvPath, "utf8");
  const parseResult: ParseResult = parsePermitCsv(csvContent);
  const totalCsvRows = csvContent.trim().split("\n").length - 1; // minus header

  process.stderr.write(
    `Parsed ${totalCsvRows} CSV rows → ${parseResult.permits.length} permit records, ${parseResult.skipped.length} skipped, ${parseResult.flagged.length} flagged\n`,
  );

  // Match to jobs
  let matchResult: MatchResult;
  const hasDb = databaseAvailable();

  if (hasDb) {
    process.stderr.write("Loading customers and jobs from database...\n");
    const customers = await loadCustomersFromDb();
    const jobs = await loadJobsFromDb();
    process.stderr.write(
      `Found ${customers.length} customers and ${jobs.length} jobs\n`,
    );
    matchResult = matchPermitsToJobs(parseResult.permits, customers, jobs);
  } else {
    process.stderr.write(
      "No database connection. All permits will be reported as unmatched.\n",
    );
    matchResult = {
      matched: [],
      unmatched: parseResult.permits.map((p) => ({
        ...p,
        matchType: "unmatched" as const,
      })),
      skipped: parseResult.skipped,
      flagged: parseResult.flagged,
    };
  }

  // Merge skipped/flagged from parse into match result
  matchResult.skipped = parseResult.skipped;
  matchResult.flagged = parseResult.flagged;

  const report = buildImportReport(parseResult, matchResult, totalCsvRows);

  // Write to database if not dry-run
  if (!args.dryRun && hasDb) {
    process.stderr.write(`Writing ${matchResult.matched.length} permits to database...\n`);
    const { written, errors } = await writePermitsToDb(matchResult);
    process.stderr.write(`Wrote ${written} permits.\n`);
    if (errors.length > 0) {
      process.stderr.write(`Errors (${errors.length}):\n`);
      for (const err of errors) {
        process.stderr.write(`  ${err}\n`);
      }
    }
  } else if (!args.dryRun && !hasDb) {
    process.stderr.write(
      "Dry-run forced: no DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.\n",
    );
  }

  // Output report
  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(
      formatReport(report, args.dryRun || !hasDb ? "dry-run" : "import") + "\n",
    );
  }

  // Exit with error code if there are unmatched rows
  if (report.unmatched > 0 && !args.dryRun) {
    process.stderr.write(
      `\nWarning: ${report.unmatched} permits could not be matched to jobs.\n`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Import failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
