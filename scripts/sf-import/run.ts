import { readFile } from "node:fs/promises";

import { SF_IMPORT_CUTOFF_DATE, SF_STALE_OPEN_DAYS, type SfImportOptions } from "../../src/lib/sf-import/constants";
import { normalizeName } from "../../src/lib/sf-import/json";
import { classifyCustomerRows, parseCustomerLinkCsv, type CustomerLink } from "../../src/lib/sf-import/linkCustomers";
import { buildImportPlan, type ImportNote, type ImportPlan } from "../../src/lib/sf-import/plan";
import { summarizeImport, type TableCount } from "../../src/lib/sf-import/report";
import { assertImportOptions, resolveImportOptions } from "../../src/lib/sf-import/scope";

import {
  databaseAvailable,
  isMissingFunction,
  openDatabase,
  safeDbMessage,
  textKey,
  type ImportDatabase,
  type KeySpec,
} from "./database";
import { readExport } from "./readExport";

const HELP = `Import Service Fusion into Loop.

  npm run sf:import -- --dir /path/to/export --dry-run

The export folder is the one that contains raw/jobs, raw/customers, and the rest.
--dry-run writes nothing. It prints how many rows would be added or updated,
and why any rows would be skipped.

A real import needs DATABASE_URL, or SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY.
Apply supabase/migrations/20261101180000_sf_import_prep.sql before the real import.
This command does not apply that migration.

Options:
  --dir <folder>              Export folder (required)
  --dry-run                   Count rows and write nothing
  --org-id <uuid>             Company to import into. Required only if Loop has more than one.
  --cutoff <YYYY-MM-DD>       Include records on or after this day. Default ${SF_IMPORT_CUTOFF_DATE}.
  --as-of <YYYY-MM-DD>        Treat this as the import date. Default is today.
  --stale-open-days <number>  Leave open jobs older than this many days. Default ${SF_STALE_OPEN_DAYS}.
  --link-customers <file.csv> Adopt existing Loop customers instead of creating duplicates.
                              Columns: loop_customer_id, sf_customer_id
  --batch-size <number>       Rows per database transaction. Default 200.
`;

const TABLE_KEYS: Record<string, { field: string; spec: KeySpec } | "parents" | "none"> = {
  customers: {
    field: "sf_id",
    spec: textKey(
      "select sf_id::text as key from public.customers where org_id = $1 and sf_id is not null",
      (client, orgId) => keysOf(client, "customers", "sf_id", orgId),
    ),
  },
  customerContacts: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.customer_contacts where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "customer_contacts", "sf_key", orgId),
    ),
  },
  properties: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.properties where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "properties", "sf_key", orgId),
    ),
  },
  jobs: {
    field: "sf_id",
    spec: textKey(
      "select sf_id::text as key from public.jobs where org_id = $1 and sf_id is not null",
      (client, orgId) => keysOf(client, "jobs", "sf_id", orgId),
    ),
  },
  jobFinancials: {
    field: "job_sf_id",
    spec: textKey(
      `select job.sf_id::text as key
       from public.job_financials price
       join public.jobs job on job.id = price.job_id
       where price.org_id = $1 and job.sf_id is not null`,
      async (client, orgId) => {
        const prices = await keysOf(client, "job_financials", "job_id", orgId);
        const jobs = await idMap(client, "jobs", orgId);
        return prices.map((jobId) => jobs.get(jobId) ?? "").filter(Boolean);
      },
    ),
  },
  jobLineItems: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.job_line_items where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "job_line_items", "sf_key", orgId),
    ),
  },
  jobAssignees: {
    field: "pair",
    spec: textKey(
      `select job.sf_id::text || ':' || assignee.user_id::text as key
       from public.job_assignees assignee
       join public.jobs job on job.id = assignee.job_id
       where assignee.org_id = $1 and job.sf_id is not null`,
      async (client, orgId) => {
        const assignees = await rowsOf(client, "job_assignees", "job_id,user_id", orgId);
        const jobs = await idMap(client, "jobs", orgId);
        return assignees.map((row) => {
          const sfId = jobs.get(String(row.job_id));
          return sfId ? `${sfId}:${String(row.user_id)}` : "";
        });
      },
    ),
  },
  jobNotes: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.job_notes where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "job_notes", "sf_key", orgId),
    ),
  },
  invoices: {
    field: "sf_id",
    spec: textKey(
      "select sf_id::text as key from public.invoices where org_id = $1 and sf_id is not null",
      (client, orgId) => keysOf(client, "invoices", "sf_id", orgId),
    ),
  },
  payments: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.payments where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "payments", "sf_key", orgId),
    ),
  },
  estimates: {
    field: "sf_id",
    spec: textKey(
      "select sf_id::text as key from public.estimates where org_id = $1 and sf_id is not null",
      (client, orgId) => keysOf(client, "estimates", "sf_id", orgId),
    ),
  },
  estimateLineItems: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.estimate_line_items where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "estimate_line_items", "sf_key", orgId),
    ),
  },
  installedSystems: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.installed_systems where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "installed_systems", "sf_key", orgId),
    ),
  },
  calendarTasks: {
    field: "sf_id",
    spec: textKey(
      "select sf_id::text as key from public.calendar_tasks where org_id = $1 and sf_id is not null",
      (client, orgId) => keysOf(client, "calendar_tasks", "sf_id", orgId),
    ),
  },
  calendarTaskAssignees: {
    field: "pair",
    spec: textKey(
      `select task.sf_id::text || ':' || assignee.user_id::text as key
       from public.calendar_task_assignees assignee
       join public.calendar_tasks task on task.id = assignee.task_id
       where assignee.org_id = $1 and task.sf_id is not null`,
      async (client, orgId) => {
        const assignees = await rowsOf(client, "calendar_task_assignees", "task_id,user_id", orgId);
        const tasks = await idMap(client, "calendar_tasks", orgId);
        return assignees.map((row) => {
          const sfId = tasks.get(String(row.task_id));
          return sfId ? `${sfId}:${String(row.user_id)}` : "";
        });
      },
    ),
  },
  timeOff: {
    field: "sf_key",
    spec: textKey(
      "select sf_key as key from public.time_off where org_id = $1 and sf_key is not null",
      (client, orgId) => keysOf(client, "time_off", "sf_key", orgId),
    ),
  },
  customerParents: "parents",
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (!args.dir) {
    process.stderr.write("Add --dir with the export folder.\n\n");
    process.stderr.write(HELP);
    process.exitCode = 1;
    return;
  }

  const options: SfImportOptions = resolveImportOptions({
    ...(args.cutoff ? { cutoffDate: args.cutoff } : {}),
    ...(args.asOf ? { asOfDate: args.asOf } : {}),
    ...(args.staleDays != null ? { staleOpenDays: args.staleDays } : {}),
  });
  const customerLinks = args.linkFile ? parseCustomerLinkCsv(await readFile(args.linkFile, "utf8")) : [];
  assertImportOptions(options);

  const bundle = await readExport(args.dir);
  let database: ImportDatabase | null = null;
  let databaseNote = "No database connection, so every in-scope row is counted as new.";
  let profiles: { id: string; fullName: string }[] = [];
  let orgId = args.orgId;

  if (databaseAvailable()) {
    database = await openDatabase();
    const orgs = await database.listOrganizations();
    if (!orgId) {
      if (orgs.length !== 1) {
        throw new Error("Loop has more than one company. Pass --org-id.");
      }
      orgId = orgs[0]?.id ?? "";
    } else if (!orgs.some((org) => org.id === orgId)) {
      throw new Error("That --org-id is not a company in this database.");
    }
    profiles = await database.loadProfiles(orgId);
    databaseNote = args.dryRun
      ? "Connected for counts only. Nothing was written."
      : "Connected. Rows were written in batches.";
  } else if (!args.dryRun) {
    throw new Error(
      "A real import needs DATABASE_URL, or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Use --dry-run to count without a database.",
    );
  }

  try {
    const plan = buildImportPlan({
      customers: bundle.customers,
      jobs: bundle.jobs,
      estimates: bundle.estimates,
      invoices: bundle.invoices,
      equipment: bundle.equipment,
      calendarTasks: bundle.calendarTasks,
      techs: bundle.techs,
      profiles,
      options,
    });

    if (database && orgId) {
      const names = await database.loadExistingNames(orgId);
      const existing = new Set(names.map((name) => normalizeName(name)).filter(Boolean));
      const linkedSfIds = new Set(customerLinks.map((link) => link.sfCustomerId));
      for (const customer of plan.customers) {
        if (linkedSfIds.has(customer.sf_id)) continue;
        if (existing.has(normalizeName(customer.name))) {
          plan.notices.push({
            table: "customers",
            sfId: String(customer.sf_id),
            reason: "same_name_as_existing_customer",
          });
        }
      }
    }

    const extraSkips: ImportNote[] = [];
    for (let index = 0; index < bundle.jobsOpenOld; index += 1) {
      extraSkips.push({ table: "jobs", sfId: "", reason: "jobs_open_old_left_in_service_fusion" });
    }

    const classified = await classify(plan, database, orgId, customerLinks);
    plan.notices.push(...classified.notices);
    let rejected = 0;
    if (!args.dryRun && database && orgId) {
      rejected = await writePlan(database, orgId, plan, classified.readyLinks, args.batchSize, extraSkips);
    }

    process.stdout.write(`${summarizeImport({
      mode: args.dryRun ? "dry-run" : "import",
      options,
      plan,
      counts: classified.counts,
      databaseNote,
      extraSkips,
    })}\n`);

    if (rejected > 0) process.exitCode = 1;
  } finally {
    await database?.close();
  }
}

async function classify(
  plan: ImportPlan,
  database: ImportDatabase | null,
  orgId: string,
  links: CustomerLink[],
): Promise<{ counts: Record<string, TableCount>; readyLinks: CustomerLink[]; notices: ImportNote[] }> {
  const counts: Record<string, TableCount> = {};
  const rowsByTable = planRows(plan);
  const existingCustomers = database && orgId ? await database.loadCustomers(orgId) : null;
  const customerClass = classifyCustomerRows(
    plan.customers.map((customer) => customer.sf_id),
    links,
    existingCustomers,
  );
  counts.customers = customerClass.counts;
  for (const [table, rows] of Object.entries(rowsByTable)) {
    if (table === "customers") continue;
    const spec = TABLE_KEYS[table];
    if (spec === "parents") {
      counts[table] = { insert: 0, update: rows.length };
      continue;
    }
    if (!spec || spec === "none" || !database || !orgId) {
      counts[table] = { insert: rows.length, update: 0 };
      continue;
    }
    const existing = await database.loadKeys(spec.spec, orgId);
    if (!existing) {
      counts[table] = { insert: rows.length, update: 0 };
      continue;
    }
    let insert = 0;
    let update = 0;
    for (const row of rows) {
      const key = rowKey(row, spec.field);
      if (key && existing.has(key)) update += 1;
      else insert += 1;
    }
    counts[table] = { insert, update };
  }
  return { counts, readyLinks: customerClass.ready, notices: customerClass.notices };
}

async function writePlan(
  database: ImportDatabase,
  orgId: string,
  plan: ImportPlan,
  readyLinks: CustomerLink[],
  batchSize: number,
  extraSkips: ImportNote[],
): Promise<number> {
  let rejected = await writeBatch(
    database,
    orgId,
    "customer_links",
    readyLinks.map((link) => ({ loop_customer_id: link.loopCustomerId, sf_id: link.sfCustomerId })),
    extraSkips,
  );
  const tables = planRows(plan);
  const order = [
    "customers",
    "customerParents",
    "customerContacts",
    "properties",
    "jobs",
    "jobFinancials",
    "jobLineItems",
    "jobAssignees",
    "jobNotes",
    "estimates",
    "estimateLineItems",
    "invoices",
    "payments",
    "installedSystems",
    "calendarTasks",
    "calendarTaskAssignees",
    "timeOff",
  ];
  for (const table of order) {
    const rows = tables[table] ?? [];
    for (let index = 0; index < rows.length; index += batchSize) {
      rejected += await writeBatch(database, orgId, table, rows.slice(index, index + batchSize), extraSkips);
    }
  }
  try {
    await database.applyBatch(orgId, "reconcile", []);
  } catch (error) {
    if (isMissingFunction(error)) {
      throw new Error(
        "The import tables are not in the database yet. Apply supabase/migrations/20261101180000_sf_import_prep.sql first. Nothing else was changed by this step.",
      );
    }
    throw error;
  }
  return rejected;
}

async function writeBatch(
  database: ImportDatabase,
  orgId: string,
  table: string,
  rows: unknown[],
  extraSkips: ImportNote[],
): Promise<number> {
  if (rows.length === 0) return 0;
  try {
    await database.applyBatch(orgId, sqlTable(table), rows);
    return 0;
  } catch (error) {
    if (isMissingFunction(error) || /unknown import table/i.test(safeDbMessage(error))) {
      throw new Error(
        "The import tables are not up to date. Apply the Service Fusion migrations, including 20261101193000_sf_import_followups.sql, before a real import.",
      );
    }
    if (rows.length === 1) {
      extraSkips.push({ table, sfId: sfIdOf(rows[0]), reason: "database_rejected" });
      process.stderr.write(`Skipped one ${table} row: ${safeDbMessage(error)}\n`);
      return 1;
    }
    const middle = Math.ceil(rows.length / 2);
    const left = await writeBatch(database, orgId, table, rows.slice(0, middle), extraSkips);
    const right = await writeBatch(database, orgId, table, rows.slice(middle), extraSkips);
    return left + right;
  }
}

function planRows(plan: ImportPlan): Record<string, unknown[]> {
  return {
    customers: plan.customers,
    customerParents: plan.customerParents,
    customerContacts: plan.customerContacts,
    properties: plan.properties,
    jobs: plan.jobs,
    jobFinancials: plan.jobFinancials,
    jobLineItems: plan.jobLineItems,
    jobAssignees: plan.jobAssignees,
    jobNotes: plan.jobNotes,
    invoices: plan.invoices,
    payments: plan.payments,
    estimates: plan.estimates,
    estimateLineItems: plan.estimateLineItems,
    installedSystems: plan.installedSystems,
    calendarTasks: plan.calendarTasks,
    calendarTaskAssignees: plan.calendarTaskAssignees,
    timeOff: plan.timeOff,
  };
}

function sqlTable(table: string): string {
  if (table === "customer_links") return "customer_links";
  if (table === "customerParents") return "customer_parents";
  if (table === "customerContacts") return "customer_contacts";
  if (table === "jobFinancials") return "job_financials";
  if (table === "jobLineItems") return "job_line_items";
  if (table === "jobAssignees") return "job_assignees";
  if (table === "jobNotes") return "job_notes";
  if (table === "estimateLineItems") return "estimate_line_items";
  if (table === "installedSystems") return "installed_systems";
  if (table === "calendarTasks") return "calendar_tasks";
  if (table === "calendarTaskAssignees") return "calendar_task_assignees";
  if (table === "timeOff") return "time_off";
  return table;
}

function rowKey(row: unknown, field: string): string {
  if (!row || typeof row !== "object") return "";
  const record = row as Record<string, unknown>;
  if (field === "pair") {
    const jobId = record.job_sf_id ?? record.task_sf_id;
    return jobId == null ? "" : `${String(jobId)}:${String(record.user_id ?? "")}`;
  }
  const value = record[field];
  return value == null ? "" : String(value);
}

function sfIdOf(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const record = row as Record<string, unknown>;
  const value = record.sf_id ?? record.job_sf_id ?? record.owner_sf_id ?? record.sf_key;
  return value == null ? "" : String(value);
}

function parseArgs(argv: string[]) {
  const args = {
    dir: "",
    dryRun: false,
    orgId: "",
    cutoff: "",
    asOf: "",
    staleDays: null as number | null,
    linkFile: "",
    batchSize: 200,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--dir") args.dir = argv[++index] ?? "";
    else if (arg === "--org-id") args.orgId = argv[++index] ?? "";
    else if (arg === "--cutoff") args.cutoff = argv[++index] ?? "";
    else if (arg === "--as-of") args.asOf = argv[++index] ?? "";
    else if (arg === "--stale-open-days") args.staleDays = Number(argv[++index] ?? "");
    else if (arg === "--link-customers") args.linkFile = argv[++index] ?? "";
    else if (arg === "--batch-size") args.batchSize = Number(argv[++index] ?? "200");
    else throw new Error(`Unknown option ${arg}. Run with --help.`);
  }
  if (!Number.isInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > 1000) {
    throw new Error("--batch-size must be a number from 1 to 1000.");
  }
  return args;
}

async function keysOf(
  client: Parameters<KeySpec["supabase"]>[0],
  table: string,
  column: string,
  orgId: string,
): Promise<string[]> {
  const rows = await rowsOf(client, table, column, orgId);
  return rows.map((row) => (row[column] == null ? "" : String(row[column])));
}

async function idMap(
  client: Parameters<KeySpec["supabase"]>[0],
  table: string,
  orgId: string,
): Promise<Map<string, string>> {
  const rows = await rowsOf(client, table, "id,sf_id", orgId);
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.sf_id != null) map.set(String(row.id), String(row.sf_id));
  }
  return map;
}

async function rowsOf(
  client: Parameters<KeySpec["supabase"]>[0],
  table: string,
  columns: string,
  orgId: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq("org_id", orgId)
      .range(from, from + 999);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

main().catch((error: unknown) => {
  process.stderr.write(`${safeDbMessage(error) || "The import stopped."}\n`);
  process.exitCode = 1;
});
