import type { SfImportOptions } from "./constants";
import { staleOpenCutoff } from "./scope";
import type { AliasedTechnician, ImportNote, ImportPlan, UnmatchedTechnician } from "./plan";

const REASONS: Record<string, string> = {
  undated_open_job: "Open job with no date. Left in Service Fusion.",
  stale_open_job: "Open job dated more than the allowed number of days before the import. Left in Service Fusion.",
  out_of_scope_before_cutoff: "Dated before the 2-year cutoff.",
  no_activity_in_window: "No job, estimate, or invoice in the window.",
  customer_record_missing: "A job or invoice names this customer, but their record is not in the export.",
  customer_not_in_export: "The customer record is not in the export.",
  parent_not_in_export: "Imported, parent link left blank. The parent account is not in the export.",
  same_name_as_existing_customer: "A customer already in Loop has this same name and was left as-is. The Service Fusion account was still added.",
  ambiguous_parent_name: "Imported, parent link left blank. More than one account has the parent name.",
  customer_link_missing: "The Loop customer in the link file was not found, so a new customer was used.",
  customer_link_taken: "That Service Fusion id is already on a different Loop customer, so the link was not used.",
  customer_link_conflict: "That Loop customer is already linked to a different Service Fusion id.",
  customer_link_not_in_import: "The link file names a Service Fusion customer that is not in this import.",
  equipment_customer_out_of_scope: "Equipment was left out because its customer is not in the import.",
  blank_street: "Location has no street, so no property was created for it.",
  unknown_sf_status: "Service Fusion status was not recognized. Saved as On Hold, and the original text was kept.",
  unknown_job_category: "Job category was not recognized. Saved as Service.",
  job_total_blank: "Job has no total, so the price was left blank.",
  negative_job_total: "Job total is negative, so it was not copied into the price field.",
  invoice_customer_unmatched: "Invoice could not be matched to one customer. The invoice was still saved.",
  ambiguous_customer_name: "More than one customer has this invoice name. The invoice was saved without a customer.",
  payment_invoice_not_imported: "Payment names an invoice that was not imported. The payment was still saved.",
  payment_without_amount: "Payment had no amount, so it was skipped.",
  duplicate_sf_id: "The same Service Fusion id appeared more than once. The last copy was kept.",
  estimate_without_date: "Estimate has no date.",
  invoice_without_date: "Invoice has no date.",
  calendar_task_without_date: "Calendar item has no usable date.",
  calendar_task_without_id: "Calendar item has no id.",
  calendar_user_unknown: "Calendar item names a Service Fusion user id that is not in the tech list.",
  time_off_without_person: "Time off is not assigned to anyone, so it was skipped.",
  time_off_unmatched_person: "Time off is assigned to someone who does not have a Loop login, so it was skipped.",
  jobs_open_old_left_in_service_fusion: "Undated open jobs from the jobs-open-old folder were left in Service Fusion.",
  database_rejected: "The database refused the row. Nothing else in that batch was kept.",
  customer_without_id: "Customer has no Service Fusion id.",
  job_without_id: "Job has no Service Fusion id.",
  estimate_without_id: "Estimate has no Service Fusion id.",
  invoice_without_id: "Invoice has no Service Fusion id.",
};

const TABLE_LABELS: Record<string, string> = {
  customers: "Customers",
  customerParents: "Parent links",
  customerContacts: "Contacts",
  properties: "Properties",
  jobs: "Jobs",
  jobFinancials: "Job prices",
  jobLineItems: "Job line items",
  jobAssignees: "Job assignments",
  jobNotes: "Job notes",
  invoices: "Invoices",
  payments: "Payments",
  estimates: "Estimates",
  estimateLineItems: "Estimate line items",
  installedSystems: "Equipment",
  calendarTasks: "Calendar tasks",
  calendarTaskAssignees: "Calendar assignments",
  timeOff: "Time off",
};

const TABLE_ORDER = [
  "customers",
  "customerParents",
  "customerContacts",
  "properties",
  "jobs",
  "jobFinancials",
  "jobLineItems",
  "jobAssignees",
  "jobNotes",
  "invoices",
  "payments",
  "estimates",
  "estimateLineItems",
  "installedSystems",
  "calendarTasks",
  "calendarTaskAssignees",
  "timeOff",
] as const;

export interface TableCount {
  insert: number;
  update: number;
  link?: number;
}

export function summarizeImport(input: {
  mode: "dry-run" | "import";
  options: SfImportOptions;
  plan: ImportPlan;
  counts: Partial<Record<(typeof TABLE_ORDER)[number], TableCount>>;
  databaseNote: string;
  extraSkips?: ImportNote[];
}): string {
  const lines: string[] = [];
  const verb = input.mode === "dry-run" ? "Would add" : "Added";
  const updateVerb = input.mode === "dry-run" ? "Would update" : "Updated";
  const linkVerb = input.mode === "dry-run" ? "Would link" : "Linked";
  lines.push(input.mode === "dry-run" ? "Service Fusion import (dry run — nothing was written)" : "Service Fusion import");
  lines.push("");
  lines.push(`Records dated on or after ${input.options.cutoffDate} are included.`);
  lines.push(
    `Open jobs with no date, and open jobs dated before ${staleOpenCutoff(input.options)} (more than ${input.options.staleOpenDays} days before ${input.options.asOfDate}), stay in Service Fusion.`,
  );
  lines.push("An open job includes Service Fusion's Completed status when it is not invoiced yet.");
  lines.push(`Times are read as ${input.options.timeZone}.`);
  lines.push(input.databaseNote);
  lines.push("");

  const skips = [...input.plan.skips, ...(input.extraSkips ?? [])];
  for (const table of TABLE_ORDER) {
    const count = input.counts[table] ?? { insert: 0, update: 0 };
    const linkCount = count.link ?? 0;
    const tableSkips = skips.filter((skip) => skip.table === table);
    const tableNotices = input.plan.notices.filter((notice) => notice.table === table);
    if (count.insert === 0 && count.update === 0 && linkCount === 0 && tableSkips.length === 0 && tableNotices.length === 0) {
      continue;
    }
    lines.push(TABLE_LABELS[table] ?? table);
    lines.push(`  ${verb}: ${count.insert}`);
    lines.push(`  ${updateVerb}: ${count.update}`);
    if (linkCount > 0) lines.push(`  ${linkVerb}: ${linkCount}`);
    if (tableSkips.length > 0) {
      lines.push(`  Not imported: ${tableSkips.length}`);
      lines.push(...detailLines(tableSkips));
    }
    if (tableNotices.length > 0) {
      lines.push(`  Notes: ${tableNotices.length}`);
      lines.push(...detailLines(tableNotices));
    }
    lines.push("");
  }

  lines.push("Technicians with no matching Loop login");
  if (input.plan.unmatchedTechnicians.length === 0) {
    lines.push("  None. Every assigned technician matched a Loop person, or no technician was assigned.");
  } else {
    lines.push("  No logins were created. Their names are saved on the job.");
    for (const tech of input.plan.unmatchedTechnicians) {
      lines.push(`  ${formatTech(tech)}`);
    }
  }
  lines.push("");
  lines.push("Technicians matched by a saved alias");
  if (input.plan.aliasedTechnicians.length === 0) {
    lines.push("  None.");
  } else {
    for (const tech of input.plan.aliasedTechnicians) {
      lines.push(`  ${formatAlias(tech)}`);
    }
  }
  lines.push("");
  lines.push(input.mode === "dry-run" ? "Dry run finished. No rows were written." : "Import finished.");
  return lines.join("\n");
}

function detailLines(notes: ImportNote[]): string[] {
  const grouped = new Map<string, { count: number; ids: string[] }>();
  for (const note of notes) {
    const current = grouped.get(note.reason) ?? { count: 0, ids: [] };
    current.count += 1;
    if (note.sfId) current.ids.push(note.sfId);
    grouped.set(note.reason, current);
  }
  const lines: string[] = [];
  for (const [reason, group] of grouped) {
    const label = REASONS[reason] ?? reason;
    lines.push(`    ${label} (${group.count})`);
    const shown = group.ids.slice(0, 30);
    if (shown.length > 0) lines.push(`      Service Fusion ids: ${shown.join(", ")}`);
    if (group.ids.length > shown.length) {
      lines.push(`      and ${group.ids.length - shown.length} more`);
    }
  }
  return lines;
}

function formatAlias(tech: AliasedTechnician): string {
  const work = [
    tech.jobs ? `${tech.jobs} job${tech.jobs === 1 ? "" : "s"}` : "",
    tech.tasks ? `${tech.tasks} calendar item${tech.tasks === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");
  return `${tech.sfName} → ${tech.loopName} — ${work || "no counted work"}.`;
}

function formatTech(tech: UnmatchedTechnician): string {
  const work = [
    tech.jobs ? `${tech.jobs} job${tech.jobs === 1 ? "" : "s"}` : "",
    tech.tasks ? `${tech.tasks} calendar item${tech.tasks === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");
  const ambiguous = tech.ambiguous ? " More than one Loop person has this name." : "";
  return `${tech.name} — ${work || "no counted work"}.${ambiguous}`;
}

export function countRows(plan: ImportPlan): Record<(typeof TABLE_ORDER)[number], number> {
  return {
    customers: plan.customers.length,
    customerParents: plan.customerParents.length,
    customerContacts: plan.customerContacts.length,
    properties: plan.properties.length,
    jobs: plan.jobs.length,
    jobFinancials: plan.jobFinancials.length,
    jobLineItems: plan.jobLineItems.length,
    jobAssignees: plan.jobAssignees.length,
    jobNotes: plan.jobNotes.length,
    invoices: plan.invoices.length,
    payments: plan.payments.length,
    estimates: plan.estimates.length,
    estimateLineItems: plan.estimateLineItems.length,
    installedSystems: plan.installedSystems.length,
    calendarTasks: plan.calendarTasks.length,
    calendarTaskAssignees: plan.calendarTaskAssignees.length,
    timeOff: plan.timeOff.length,
  };
}
