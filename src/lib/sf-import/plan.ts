import { joinAddressParts } from "../address";

import { addressMatchKey, normalizeState } from "./address";
import type { SfImportOptions } from "./constants";
import { resolveImportOptions } from "./scope";
import {
  asArray,
  asBoolean,
  asId,
  asNumber,
  asRecord,
  asString,
  dateOnly,
  normalizeName,
  stableHash,
} from "./json";
import { dollarsToCents } from "./money";
import { scheduleJob, scheduleTask, timestampOrNull } from "./schedule";
import { jobScopeDecision, parentRef, recordOnOrAfter } from "./scope";
import { mapJobStatus, mapJobType, mapPriority, sfJobNumber } from "./status";
import {
  type LoopProfile,
  type MatchedTech,
  matchTechNames,
  personName,
  type TechRef,
  type UnmatchedTech,
} from "./techs";

export interface ImportNote {
  table: string;
  sfId: string;
  reason: string;
}

export interface CustomerDraft {
  sf_id: number;
  name: string;
  primary_contact: string;
  email: string;
  phone: string;
  phone2: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  status: "Active";
  notes: string;
  last_activity: string | null;
  created_at: string | null;
}

export interface ParentLinkDraft {
  sf_id: number;
  parent_sf_id: number;
}

export interface ContactDraft {
  customer_sf_id: number;
  sf_key: string;
  name: string;
  email: string;
  phone: string;
  phone2: string;
  job_title: string;
  is_primary: boolean;
  notes: string;
}

export interface PropertyDraft {
  customer_sf_id: number;
  sf_key: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  formatted_address: string;
  latitude: number | null;
  longitude: number | null;
  type: "Residential" | "Commercial";
  status: "Active";
}

export interface JobDraft {
  sf_id: number;
  customer_sf_id: number;
  property_sf_key: string | null;
  job_number: string;
  title: string;
  summary: string;
  notes: string;
  type: string;
  status: string;
  sf_status: string;
  priority: string;
  customer_name: string;
  property_name: string;
  location: string;
  assigned_to: string;
  assigned_user_id: string | null;
  sf_tech_names: string;
  scheduled_for: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  arrival_window_start_at: string | null;
  arrival_window_end_at: string | null;
  created_at: string | null;
}

export interface FinancialDraft {
  job_sf_id: number;
  revenue_cents: number;
}

export interface LineDraft {
  owner_sf_id: number;
  sf_key: string;
  kind: "service" | "product" | "other_charge";
  name: string;
  description: string;
  qty: number;
  rate_cents: number | null;
  rate_percent: number | null;
  total_cents: number | null;
  cost_cents: number | null;
  taxable: boolean;
  is_discount: boolean;
  is_percentage: boolean;
  sort_order: number;
}

export interface AssigneeDraft {
  job_sf_id: number;
  user_id: string;
  sf_tech_id: number | null;
}

export interface JobNoteDraft {
  job_sf_id: number;
  sf_key: string;
  body: string;
  author_name: string;
  author_role: "";
  created_at: string | null;
}

export interface InvoiceDraft {
  sf_id: number;
  job_sf_id: number | null;
  customer_sf_id: number | null;
  number: string;
  invoice_date: string | null;
  total_cents: number | null;
  is_paid: boolean;
  terms: string;
  notes: string;
  currency: string;
  po_number: string;
}

export interface PaymentDraft {
  sf_id: number | null;
  sf_key: string;
  job_sf_id: number | null;
  invoice_sf_id: number | null;
  estimate_sf_id: number | null;
  customer_sf_id: number | null;
  amount_cents: number;
  received_on: string | null;
  memo: string;
  payment_type: string;
  reference_number: string;
  apply_to: string;
  transaction_type: string;
}

export interface EstimateDraft {
  sf_id: number;
  customer_sf_id: number | null;
  property_sf_key: string | null;
  number: string;
  status: string;
  description: string;
  tech_notes: string;
  total_cents: number | null;
  taxes_fees_cents: number | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  location_name: string;
  created_at: string | null;
}

export interface EquipmentDraft {
  sf_id: number | null;
  sf_key: string;
  customer_sf_id: number;
  property_sf_key: string | null;
  system_name: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  install_date: string;
  warranty_expiry: string;
  location: string;
  property_name: string;
  customer_name: string;
  lifecycle_status: "Active";
  match_state: "exact" | "possible" | "unmatched";
  notes: string;
  attributes: Record<string, unknown>;
}

export interface CalendarTaskDraft {
  sf_id: number;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  job_sf_id: number | null;
  customer_sf_id: number | null;
  done_at: string | null;
}

export interface TaskAssigneeDraft {
  task_sf_id: number;
  user_id: string;
}

export interface TimeOffDraft {
  sf_key: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  reason: string;
  note: string;
}

export interface UnmatchedTechnician {
  name: string;
  jobs: number;
  tasks: number;
  ambiguous: boolean;
}

export interface AliasedTechnician {
  sfName: string;
  loopName: string;
  jobs: number;
  tasks: number;
}

export interface ImportPlan {
  options: SfImportOptions;
  customers: CustomerDraft[];
  customerParents: ParentLinkDraft[];
  customerContacts: ContactDraft[];
  properties: PropertyDraft[];
  jobs: JobDraft[];
  jobFinancials: FinancialDraft[];
  jobLineItems: LineDraft[];
  jobAssignees: AssigneeDraft[];
  jobNotes: JobNoteDraft[];
  invoices: InvoiceDraft[];
  payments: PaymentDraft[];
  estimates: EstimateDraft[];
  estimateLineItems: LineDraft[];
  installedSystems: EquipmentDraft[];
  calendarTasks: CalendarTaskDraft[];
  calendarTaskAssignees: TaskAssigneeDraft[];
  timeOff: TimeOffDraft[];
  skips: ImportNote[];
  notices: ImportNote[];
  unmatchedTechnicians: UnmatchedTechnician[];
  aliasedTechnicians: AliasedTechnician[];
}

export interface PlanInput {
  customers: unknown[];
  jobs: unknown[];
  estimates: unknown[];
  invoices: unknown[];
  equipment: { customerSfId: number; items: unknown[] }[];
  calendarTasks: unknown[];
  techs: unknown[];
  profiles: LoopProfile[];
  options?: Partial<SfImportOptions>;
}

interface PropertyBuild extends PropertyDraft {
  matchKey: string;
  isPrimary: boolean;
}

export function buildImportPlan(input: PlanInput): ImportPlan {
  const options: SfImportOptions = resolveImportOptions(input.options);
  const skips: ImportNote[] = [];
  const notices: ImportNote[] = [];

  const customers = dedupe(input.customers, "customers", skips);
  const jobs = dedupe(input.jobs, "jobs", skips);
  const estimates = dedupe(input.estimates, "estimates", skips);
  const invoiceRecords = dedupe(input.invoices, "invoices", skips);

  const customerById = new Map<number, Record<string, unknown>>();
  const idsByName = new Map<string, number[]>();
  for (const customer of customers) {
    const id = asId(customer.id);
    if (id == null) {
      skips.push({ table: "customers", sfId: "", reason: "customer_without_id" });
      continue;
    }
    customerById.set(id, customer);
    const name = normalizeName(asString(customer.customer_name));
    if (!name) continue;
    const list = idsByName.get(name) ?? [];
    list.push(id);
    idsByName.set(name, list);
  }

  const includedJobs: Record<string, unknown>[] = [];
  for (const job of jobs) {
    const id = asId(job.id);
    const decision = jobScopeDecision(job, options);
    if (!decision.include) {
      skips.push({ table: "jobs", sfId: id == null ? "" : String(id), reason: decision.reason });
      continue;
    }
    if (id == null) {
      skips.push({ table: "jobs", sfId: "", reason: "job_without_id" });
      continue;
    }
    includedJobs.push(job);
  }

  const includedEstimates: Record<string, unknown>[] = [];
  for (const estimate of estimates) {
    const id = asId(estimate.id);
    const dated = recordOnOrAfter(estimate.created_at, options.cutoffDate)
      || recordOnOrAfter(estimate.start_date, options.cutoffDate);
    if (!dated) {
      skips.push({
        table: "estimates",
        sfId: id == null ? "" : String(id),
        reason: dateOnly(estimate.created_at) || dateOnly(estimate.start_date)
          ? "out_of_scope_before_cutoff"
          : "estimate_without_date",
      });
      continue;
    }
    if (id == null) {
      skips.push({ table: "estimates", sfId: "", reason: "estimate_without_id" });
      continue;
    }
    includedEstimates.push(estimate);
  }

  const standaloneInvoices: Record<string, unknown>[] = [];
  for (const invoice of invoiceRecords) {
    const id = asId(invoice.id);
    const dated = recordOnOrAfter(invoice.date, options.cutoffDate)
      || recordOnOrAfter(invoice.created_at, options.cutoffDate);
    if (!dated) {
      skips.push({
        table: "invoices",
        sfId: id == null ? "" : String(id),
        reason: dateOnly(invoice.date) || dateOnly(invoice.created_at)
          ? "out_of_scope_before_cutoff"
          : "invoice_without_date",
      });
      continue;
    }
    if (id == null) {
      skips.push({ table: "invoices", sfId: "", reason: "invoice_without_id" });
      continue;
    }
    standaloneInvoices.push(invoice);
  }

  const activityIds = new Set<number>();
  for (const job of includedJobs) {
    const id = asId(job.customer_id);
    if (id != null) activityIds.add(id);
  }
  for (const estimate of includedEstimates) {
    const id = asId(estimate.customer_id);
    if (id != null) activityIds.add(id);
  }
  for (const invoice of standaloneInvoices) {
    const billed = asId(invoice.bill_to_customer_id);
    if (billed != null) {
      activityIds.add(billed);
      continue;
    }
    const matches = idsByName.get(normalizeName(asString(invoice.customer))) ?? [];
    if (matches.length === 1) activityIds.add(matches[0]);
  }

  const importedIds = new Set(activityIds);
  const parentOf = new Map<number, number>();
  for (let depth = 0; depth < 5; depth += 1) {
    let grew = false;
    for (const id of importedIds) {
      const record = customerById.get(id);
      if (!record || parentOf.has(id)) continue;
      const resolved = resolveParent(record.parent_customer, id, customerById, idsByName);
      if (resolved.kind === "none") continue;
      if (resolved.kind === "linked") {
        parentOf.set(id, resolved.id);
        if (!importedIds.has(resolved.id)) {
          importedIds.add(resolved.id);
          grew = true;
        }
        continue;
      }
      notices.push({ table: "customers", sfId: String(id), reason: resolved.reason });
      parentOf.set(id, -1);
    }
    if (!grew) break;
  }

  for (const [id] of customerById) {
    if (!importedIds.has(id)) {
      skips.push({ table: "customers", sfId: String(id), reason: "no_activity_in_window" });
    }
  }
  for (const id of activityIds) {
    if (!customerById.has(id)) {
      skips.push({ table: "customers", sfId: String(id), reason: "customer_record_missing" });
    }
  }

  const parentIds = new Set<number>();
  for (const parentId of parentOf.values()) {
    if (parentId > 0) parentIds.add(parentId);
  }

  const customerRows: CustomerDraft[] = [];
  const contactRows: ContactDraft[] = [];
  const customerNameById = new Map<number, string>();
  for (const id of [...importedIds].sort((a, b) => a - b)) {
    const record = customerById.get(id);
    if (!record) continue;
    const mapped = mapCustomer(id, record);
    customerRows.push(mapped.customer);
    contactRows.push(...mapped.contacts);
    customerNameById.set(id, mapped.customer.name);
  }

  const propertiesByCustomer = new Map<number, Map<string, PropertyBuild>>();
  for (const id of importedIds) {
    const record = customerById.get(id);
    if (!record) continue;
    const type = propertyType(id, record, parentIds);
    const bucket = new Map<string, PropertyBuild>();
    let primaryKey: string | null = null;
    let fallbackKey: string | null = null;
    asArray(record.locations).forEach((location, index) => {
      const row = asRecord(location);
      if (!row) return;
      const built = propertyFromAddress(id, row, type);
      if (!built) {
        skips.push({ table: "properties", sfId: String(id), reason: "blank_street" });
        return;
      }
      built.sf_key = `cust:${id}:loc:${built.matchKey}:${index}`;
      const existing = bucket.get(built.matchKey);
      if (existing) {
        if (asBoolean(row.is_primary)) existing.isPrimary = true;
        return;
      }
      // One property per normalized street and zip. The index stays out of the key
      // so a job at the same address finds it. Rebuild the key without the index.
      built.sf_key = `cust:${id}:loc:${built.matchKey}`;
      bucket.set(built.matchKey, built);
      if (asBoolean(row.is_primary)) primaryKey = built.matchKey;
      if (!fallbackKey && asBoolean(row.is_bill_to)) fallbackKey = built.matchKey;
      if (!fallbackKey) fallbackKey = built.matchKey;
    });
    const chosen = primaryKey ?? fallbackKey;
    if (chosen) {
      const primary = bucket.get(chosen);
      if (primary) primary.isPrimary = true;
    }
    propertiesByCustomer.set(id, bucket);
  }

  const techDirectory = techDirectoryFrom(input.techs, includedJobs);
  const unmatched = new Map<string, UnmatchedTechnician>();
  const aliased = new Map<string, AliasedTechnician>();
  const rememberUnmatched = (items: UnmatchedTech[], kind: "jobs" | "tasks") => {
    for (const item of items) {
      const key = `${item.ambiguous ? "a" : "u"}:${item.name.toLowerCase()}`;
      const current = unmatched.get(key) ?? {
        name: item.name,
        jobs: 0,
        tasks: 0,
        ambiguous: item.ambiguous,
      };
      current[kind] += 1;
      unmatched.set(key, current);
    }
  };
  const rememberAliased = (items: MatchedTech[], kind: "jobs" | "tasks") => {
    for (const item of items) {
      if (!item.aliased) continue;
      const key = item.sfName.toLowerCase();
      const current = aliased.get(key) ?? {
        sfName: item.sfName,
        loopName: item.fullName,
        jobs: 0,
        tasks: 0,
      };
      current[kind] += 1;
      aliased.set(key, current);
    }
  };

  const jobRows: JobDraft[] = [];
  const financials: FinancialDraft[] = [];
  const jobLines: LineDraft[] = [];
  const assignees: AssigneeDraft[] = [];
  const jobNotes: JobNoteDraft[] = [];
  const invoiceById = new Map<number, InvoiceDraft>();
  const payments: PaymentDraft[] = [];
  const paymentKeys = new Set<string>();

  for (const job of includedJobs) {
    const id = asId(job.id);
    const customerId = asId(job.customer_id);
    if (id == null || customerId == null || !customerById.has(customerId) || !importedIds.has(customerId)) {
      skips.push({
        table: "jobs",
        sfId: id == null ? "" : String(id),
        reason: "customer_not_in_export",
      });
      continue;
    }

    const customer = customerById.get(customerId);
    const bucket = propertiesByCustomer.get(customerId) ?? new Map<string, PropertyBuild>();
    propertiesByCustomer.set(customerId, bucket);
    const type = propertyType(customerId, customer ?? {}, parentIds);
    const property = ensureProperty(bucket, customerId, job, type);
    const schedule = scheduleJob(job, options.timeZone);
    const status = mapJobStatus(asString(job.status));
    if (status.unknown) {
      notices.push({ table: "jobs", sfId: String(id), reason: "unknown_sf_status" });
    }
    const jobType = mapJobType(asString(job.category));
    if (jobType.unknown) {
      notices.push({ table: "jobs", sfId: String(id), reason: "unknown_job_category" });
    }
    const techs = techRefs(job.techs_assigned, techDirectory);
    const matchedTechs = matchTechNames(techs, input.profiles);
    rememberUnmatched(matchedTechs.unmatched, "jobs");
    rememberAliased(matchedTechs.matched, "jobs");
    const lead = matchedTechs.matched[0];
    const number = sfJobNumber(asString(job.number), options.jobNumberPrefix) || `${options.jobNumberPrefix}${id}`;
    const description = asString(job.description);
    const category = asString(job.category);

    jobRows.push({
      sf_id: id,
      customer_sf_id: customerId,
      property_sf_key: property?.sf_key ?? null,
      job_number: number,
      title: jobTitle(category, description, number),
      summary: description,
      notes: jobNotesText(job),
      type: jobType.type,
      status: status.status,
      sf_status: asString(job.status),
      priority: mapPriority(asString(job.priority)),
      customer_name: customerNameById.get(customerId) || asString(job.customer_name),
      property_name: property?.name ?? "",
      location: property?.formatted_address || formatAddress(job),
      assigned_to: lead?.fullName ?? "",
      assigned_user_id: lead?.userId ?? null,
      sf_tech_names: matchedTechs.unmatched.map((item) => item.name).join(", "),
      ...schedule,
      created_at: timestampOrNull(job.created_at),
    });

    const cents = dollarsToCents(job.total);
    if (cents == null) {
      notices.push({ table: "jobs", sfId: String(id), reason: "job_total_blank" });
    } else if (cents < 0) {
      notices.push({ table: "jobs", sfId: String(id), reason: "negative_job_total" });
    } else {
      financials.push({ job_sf_id: id, revenue_cents: cents });
    }

    jobLines.push(...mapLines(job, id, `job:${id}`));
    for (const tech of matchedTechs.matched) {
      assignees.push({ job_sf_id: id, user_id: tech.userId, sf_tech_id: tech.sfId });
    }
    asArray(job.notes).forEach((note, index) => {
      const record = asRecord(note);
      const body = record
        ? asString(record.notes) || asString(record.note) || asString(record.body) || asString(record.text)
        : asString(note);
      if (!body) return;
      const created = record ? timestampOrNull(record.created_at) : null;
      jobNotes.push({
        job_sf_id: id,
        sf_key: `job:${id}:note:${created ?? index}:${stableHash(body)}`,
        body,
        author_name: "Service Fusion import",
        author_role: "",
        created_at: created,
      });
    });

    for (const raw of asArray(job.invoices)) {
      const invoice = asRecord(raw);
      if (!invoice) continue;
      const invoiceId = asId(invoice.id);
      if (invoiceId == null) continue;
      invoiceById.set(invoiceId, mapInvoice(invoice, invoiceId, id, customerId));
    }
    collectPayments(job, {
      ownerKey: `job:${id}`,
      jobSfId: id,
      estimateSfId: null,
      customerSfId: customerId,
      payments,
      paymentKeys,
      notices,
    });
  }

  const estimateRows: EstimateDraft[] = [];
  const estimateLines: LineDraft[] = [];
  for (const estimate of includedEstimates) {
    const id = asId(estimate.id);
    if (id == null) continue;
    const customerId = asId(estimate.customer_id);
    const linkedCustomer = customerId != null && importedIds.has(customerId) && customerById.has(customerId)
      ? customerId
      : null;
    if (customerId != null && linkedCustomer == null) {
      notices.push({ table: "estimates", sfId: String(id), reason: "customer_not_in_export" });
    }
    const bucket = linkedCustomer != null ? propertiesByCustomer.get(linkedCustomer) : undefined;
    const property = bucket ? ensureProperty(
      bucket,
      linkedCustomer as number,
      estimate,
      propertyType(linkedCustomer as number, customerById.get(linkedCustomer as number) ?? {}, parentIds),
    ) : null;
    const total = dollarsToCents(estimate.total);
    estimateRows.push({
      sf_id: id,
      customer_sf_id: linkedCustomer,
      property_sf_key: property?.sf_key ?? null,
      number: asString(estimate.number),
      status: asString(estimate.status),
      description: asString(estimate.description),
      tech_notes: asString(estimate.tech_notes),
      total_cents: total,
      taxes_fees_cents: dollarsToCents(estimate.taxes_fees_total),
      street: joinAddressParts([asString(estimate.street_1), asString(estimate.street_2)]),
      city: asString(estimate.city),
      state: normalizeState(asString(estimate.state_prov)),
      zip: asString(estimate.postal_code),
      location_name: asString(estimate.location_name),
      created_at: timestampOrNull(estimate.created_at),
    });
    estimateLines.push(...mapLines(estimate, id, `estimate:${id}`));
    collectPayments(estimate, {
      ownerKey: `estimate:${id}`,
      jobSfId: null,
      estimateSfId: id,
      customerSfId: linkedCustomer,
      payments,
      paymentKeys,
      notices,
    });
  }

  for (const invoice of standaloneInvoices) {
    const id = asId(invoice.id);
    if (id == null || invoiceById.has(id)) {
      if (id != null && invoiceById.has(id)) {
        const existing = invoiceById.get(id);
        if (existing && !existing.invoice_date) {
          existing.invoice_date = timestampOrNull(invoice.date) ?? timestampOrNull(invoice.created_at);
        }
      }
      continue;
    }
    const billed = asId(invoice.bill_to_customer_id);
    let customerId: number | null = billed != null && importedIds.has(billed) ? billed : null;
    if (customerId == null) {
      const matches = (idsByName.get(normalizeName(asString(invoice.customer))) ?? [])
        .filter((match) => importedIds.has(match));
      if (matches.length === 1) customerId = matches[0];
      else notices.push({
        table: "invoices",
        sfId: String(id),
        reason: matches.length > 1 ? "ambiguous_customer_name" : "invoice_customer_unmatched",
      });
    }
    invoiceById.set(id, mapInvoice(invoice, id, null, customerId));
  }

  const importedInvoiceIds = new Set(invoiceById.keys());
  for (const payment of payments) {
    if (payment.invoice_sf_id != null && !importedInvoiceIds.has(payment.invoice_sf_id)) {
      notices.push({
        table: "payments",
        sfId: payment.sf_id == null ? payment.sf_key : String(payment.sf_id),
        reason: "payment_invoice_not_imported",
      });
      payment.invoice_sf_id = null;
    }
  }

  const equipmentRows: EquipmentDraft[] = [];
  for (const group of input.equipment) {
    if (!importedIds.has(group.customerSfId) || !customerById.has(group.customerSfId)) {
      group.items.forEach((item) => {
        const record = asRecord(item);
        const equipmentId = record ? asId(record.id) : null;
        skips.push({
          table: "installedSystems",
          sfId: equipmentId == null ? String(group.customerSfId) : String(equipmentId),
          reason: "equipment_customer_out_of_scope",
        });
      });
      continue;
    }
    const bucket = propertiesByCustomer.get(group.customerSfId) ?? new Map<string, PropertyBuild>();
    propertiesByCustomer.set(group.customerSfId, bucket);
    group.items.forEach((item, index) => {
      const record = asRecord(item);
      if (!record) return;
      equipmentRows.push(mapEquipment(record, group.customerSfId, index, bucket, customerNameById));
    });
  }

  const calendarRows: CalendarTaskDraft[] = [];
  const taskAssignees: TaskAssigneeDraft[] = [];
  const timeOff: TimeOffDraft[] = [];
  const includedJobIds = new Set(jobRows.map((job) => job.sf_id));
  for (const task of input.calendarTasks) {
    const record = asRecord(task);
    if (!record) continue;
    const id = asId(record.id);
    if (!recordOnOrAfter(record.start_date, options.cutoffDate)) {
      skips.push({
        table: "calendar_tasks",
        sfId: id == null ? "" : String(id),
        reason: dateOnly(record.start_date) ? "out_of_scope_before_cutoff" : "calendar_task_without_date",
      });
      continue;
    }
    if (id == null) {
      skips.push({ table: "calendar_tasks", sfId: "", reason: "calendar_task_without_id" });
      continue;
    }
    const window = scheduleTask(record, options.timeZone);
    if (!window) {
      skips.push({ table: "calendar_tasks", sfId: String(id), reason: "calendar_task_without_date" });
      continue;
    }
    const idRefs = refsFromIds(record.users_id, techDirectory, notices, id);
    const matched = matchTechNames(idRefs, input.profiles);
    rememberUnmatched(matched.unmatched, "tasks");
    rememberAliased(matched.matched, "tasks");

    if (asBoolean(record.is_time_off)) {
      if (matched.matched.length === 0) {
        skips.push({
          table: "time_off",
          sfId: String(id),
          reason: idRefs.length === 0 ? "time_off_without_person" : "time_off_unmatched_person",
        });
        continue;
      }
      const reason = asString(record.description) || "Time off";
      for (const tech of matched.matched) {
        timeOff.push({
          sf_key: `timeoff:${id}:${tech.userId}`,
          user_id: tech.userId,
          starts_at: window.starts_at,
          ends_at: window.ends_at,
          all_day: window.all_day,
          reason,
          note: asString(record.time_off_type),
        });
      }
      continue;
    }

    const jobSfId = firstImportedId(record.jobs_id, includedJobIds);
    const customerSfId = firstImportedId(record.customers_id, importedIds);
    const description = asString(record.description);
    calendarRows.push({
      sf_id: id,
      title: description || "Service Fusion task",
      description,
      starts_at: window.starts_at,
      ends_at: window.ends_at,
      all_day: window.all_day,
      job_sf_id: jobSfId,
      customer_sf_id: customerSfId,
      done_at: asBoolean(record.is_completed) ? timestampOrNull(record.updated_at) : null,
    });
    for (const tech of matched.matched) {
      taskAssignees.push({ task_sf_id: id, user_id: tech.userId });
    }
  }

  const propertyRows = [...propertiesByCustomer.values()]
    .flatMap((bucket) => [...bucket.values()].map(propertyDraft))
    .sort((left, right) => left.sf_key.localeCompare(right.sf_key));

  return {
    options,
    customers: customerRows,
    customerParents: [...parentOf.entries()]
      .filter(([, parentId]) => parentId > 0)
      .map(([sfId, parentSfId]) => ({ sf_id: sfId, parent_sf_id: parentSfId }))
      .sort((left, right) => left.sf_id - right.sf_id),
    customerContacts: contactRows,
    properties: propertyRows,
    jobs: jobRows.sort((left, right) => left.sf_id - right.sf_id),
    jobFinancials: financials,
    jobLineItems: jobLines,
    jobAssignees: assignees,
    jobNotes,
    invoices: [...invoiceById.values()].sort((left, right) => left.sf_id - right.sf_id),
    payments,
    estimates: estimateRows.sort((left, right) => left.sf_id - right.sf_id),
    estimateLineItems: estimateLines,
    installedSystems: equipmentRows,
    calendarTasks: calendarRows,
    calendarTaskAssignees: taskAssignees,
    timeOff,
    skips,
    notices,
    unmatchedTechnicians: [...unmatched.values()].sort((left, right) => left.name.localeCompare(right.name)),
    aliasedTechnicians: [...aliased.values()].sort((left, right) => left.sfName.localeCompare(right.sfName)),
  };
}

function dedupe(rows: unknown[], table: string, skips: ImportNote[]): Record<string, unknown>[] {
  const byId = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const id = asId(record.id);
    if (id == null) {
      byId.set(-byId.size - 1, record);
      continue;
    }
    if (byId.has(id)) skips.push({ table, sfId: String(id), reason: "duplicate_sf_id" });
    byId.set(id, record);
  }
  return [...byId.values()];
}

function resolveParent(
  value: unknown,
  childId: number,
  customerById: Map<number, Record<string, unknown>>,
  idsByName: Map<string, number[]>,
): { kind: "none" } | { kind: "linked"; id: number } | { kind: "missing"; reason: "parent_not_in_export" } | { kind: "bad"; reason: "ambiguous_parent_name" } {
  const ref = parentRef(value);
  if (ref.kind === "none") return { kind: "none" };
  if (ref.kind === "id") {
    if (ref.id === childId) return { kind: "none" };
    if (!customerById.has(ref.id)) return { kind: "missing", reason: "parent_not_in_export" };
    return { kind: "linked", id: ref.id };
  }
  const matches = (idsByName.get(normalizeName(ref.name)) ?? []).filter((id) => id !== childId);
  if (matches.length === 1) return { kind: "linked", id: matches[0] };
  if (matches.length === 0) return { kind: "missing", reason: "parent_not_in_export" };
  return { kind: "bad", reason: "ambiguous_parent_name" };
}

function mapCustomer(id: number, record: Record<string, unknown>): { customer: CustomerDraft; contacts: ContactDraft[] } {
  const contacts = asArray(record.contacts).map(asRecord).filter((item): item is Record<string, unknown> => item != null);
  const primary = contacts.find((contact) => asBoolean(contact.is_primary)) ?? contacts[0] ?? null;
  const primaryPhones = primary ? phonesOf(primary) : [];
  const contactName = primary
    ? personName(asString(primary.fname), asString(primary.lname))
    : "";
  const name = asString(record.customer_name) || contactName || `Service Fusion ${id}`;
  const location = primaryLocation(record);
  const notes = joinText([
    asString(record.private_notes),
    asString(record.public_notes),
    accountFacts(record),
    customFieldLines(record.custom_fields).join("\n"),
  ]);

  const contactRows: ContactDraft[] = contacts.map((contact, index) => {
    const phones = phonesOf(contact);
    const emails = emailsOf(contact);
    const extra = [
      phones.slice(2).length ? `Other phones: ${phones.slice(2).join(", ")}` : "",
      emails.slice(1).length ? `Other emails: ${emails.slice(1).join(", ")}` : "",
    ].filter(Boolean).join("\n");
    const contactLabel = personName(asString(contact.fname), asString(contact.lname)) || name;
    return {
      customer_sf_id: id,
      sf_key: `cust:${id}:contact:${index}:${stableHash(`${contactLabel}|${emails[0] ?? ""}`)}`,
      name: contactLabel,
      email: emails[0] ?? "",
      phone: phones[0] ?? "",
      phone2: phones[1] ?? "",
      job_title: asString(contact.job_title),
      is_primary: contact === primary,
      notes: extra,
    };
  });

  return {
    customer: {
      sf_id: id,
      name,
      primary_contact: contactName,
      email: primary ? (emailsOf(primary)[0] ?? "") : "",
      phone: primaryPhones[0] ?? "",
      phone2: primaryPhones[1] ?? "",
      street: location ? joinAddressParts([asString(location.street_1), asString(location.street_2)]) : "",
      city: location ? asString(location.city) : "",
      state: location ? normalizeState(asString(location.state_prov)) : "",
      zip: location ? asString(location.postal_code) : "",
      status: "Active",
      notes,
      last_activity: dateOnly(record.last_serviced_date),
      created_at: timestampOrNull(record.created_at),
    },
    contacts: contactRows,
  };
}

function phonesOf(contact: Record<string, unknown>): string[] {
  const ranked = asArray(contact.phones).flatMap((item, index) => {
    const record = asRecord(item);
    if (!record) return [];
    const phone = asString(record.phone);
    if (!phone) return [];
    const type = asString(record.type).toLowerCase();
    const score = asBoolean(record.is_mobile) || type === "mobile" ? 2 : 1;
    return [{ phone, score, index }];
  });
  ranked.sort((left, right) => right.score - left.score || left.index - right.index);
  const unique: string[] = [];
  for (const item of ranked) {
    if (!unique.includes(item.phone)) unique.push(item.phone);
  }
  return unique;
}

function emailsOf(contact: Record<string, unknown>): string[] {
  const emails: string[] = [];
  for (const item of asArray(contact.emails)) {
    const record = asRecord(item);
    const email = record ? asString(record.email) : asString(item);
    if (email && !emails.includes(email)) emails.push(email);
  }
  return emails;
}

function primaryLocation(record: Record<string, unknown>): Record<string, unknown> | null {
  const locations = asArray(record.locations).map(asRecord).filter((item): item is Record<string, unknown> => item != null);
  return locations.find((location) => asBoolean(location.is_primary))
    ?? locations.find((location) => asBoolean(location.is_bill_to))
    ?? locations.find((location) => asString(location.street_1))
    ?? null;
}

function accountFacts(record: Record<string, unknown>): string {
  const lines: string[] = [];
  const account = asString(record.account_number);
  const terms = asString(record.payment_terms);
  const referral = asString(record.referral_source);
  const balance = asNumber(record.account_balance);
  if (account) lines.push(`Account number: ${account}`);
  if (terms) lines.push(`Payment terms: ${terms}`);
  if (referral) lines.push(`Referral: ${referral}`);
  if (balance) lines.push(`Account balance: ${balance}`);
  return lines.join("\n");
}

function customFieldLines(value: unknown): string[] {
  const lines: string[] = [];
  for (const field of asArray(value)) {
    const record = asRecord(field);
    if (!record) continue;
    const name = asString(record.name);
    const fieldValue = asString(record.value);
    if (name && fieldValue) lines.push(`${name}: ${fieldValue}`);
  }
  return lines;
}

function propertyType(
  customerId: number,
  record: Record<string, unknown>,
  parentIds: Set<number>,
): "Residential" | "Commercial" {
  if (parentIds.has(customerId) || asString(record.industry)) return "Commercial";
  return "Residential";
}

function propertyDraft(row: PropertyBuild): PropertyDraft {
  return {
    customer_sf_id: row.customer_sf_id,
    sf_key: row.sf_key,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    formatted_address: row.formatted_address,
    latitude: row.latitude,
    longitude: row.longitude,
    type: row.type,
    status: row.status,
  };
}

function propertyFromAddress(
  customerId: number,
  source: Record<string, unknown>,
  type: "Residential" | "Commercial",
): PropertyBuild | null {
  const street = asString(source.street_1);
  const city = asString(source.city);
  const zip = asString(source.postal_code);
  const matchKey = addressMatchKey(street, zip, city);
  if (!matchKey) return null;
  const state = normalizeState(asString(source.state_prov));
  const address = joinAddressParts([street, asString(source.street_2)]);
  const coords = coordinates(source);
  return {
    customer_sf_id: customerId,
    sf_key: `cust:${customerId}:loc:${matchKey}`,
    matchKey,
    name: asString(source.nickname) || asString(source.location_name) || street || "Property",
    address,
    city,
    state,
    zip,
    formatted_address: formatAddress(source),
    latitude: coords.latitude,
    longitude: coords.longitude,
    type,
    status: "Active",
    isPrimary: asBoolean(source.is_primary),
  };
}

function ensureProperty(
  bucket: Map<string, PropertyBuild>,
  customerId: number,
  source: Record<string, unknown>,
  type: "Residential" | "Commercial",
): PropertyBuild | null {
  const matchKey = addressMatchKey(asString(source.street_1), asString(source.postal_code), asString(source.city));
  if (!matchKey) return null;
  const existing = bucket.get(matchKey);
  if (existing) return existing;
  const created = propertyFromAddress(customerId, source, type);
  if (!created) return null;
  bucket.set(matchKey, created);
  return created;
}

function coordinates(source: Record<string, unknown>): { latitude: number | null; longitude: number | null } {
  const latitude = asNumber(source.latitude);
  const longitude = asNumber(source.longitude);
  if (latitude == null || longitude == null) return { latitude: null, longitude: null };
  if (latitude === 0 && longitude === 0) return { latitude: null, longitude: null };
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { latitude: null, longitude: null };
  return { latitude, longitude };
}

function formatAddress(source: Record<string, unknown>): string {
  return joinAddressParts([
    asString(source.street_1),
    asString(source.street_2),
    asString(source.city),
    normalizeState(asString(source.state_prov)),
    asString(source.postal_code),
  ]);
}

function jobTitle(category: string, description: string, number: string): string {
  const short = description.replace(/\s+/g, " ").trim().slice(0, 140);
  if (category && short) return `${category}: ${short}`;
  if (category) return category;
  if (short) return short;
  return number;
}

function jobNotesText(job: Record<string, unknown>): string {
  const contact = personName(asString(job.contact_first_name), asString(job.contact_last_name));
  const lines = [
    asString(job.tech_notes) ? `Tech notes:\n${asString(job.tech_notes)}` : "",
    asString(job.completion_notes) ? `Completion notes:\n${asString(job.completion_notes)}` : "",
    contact ? `Site contact: ${contact}` : "",
    asString(job.po_number) ? `PO: ${asString(job.po_number)}` : "",
    asString(job.source) ? `Source: ${asString(job.source)}` : "",
    asString(job.contract) ? `Agreement: ${asString(job.contract)}` : "",
    asString(job.gate_instructions) ? `Gate: ${asString(job.gate_instructions)}` : "",
    customFieldLines(job.custom_fields).join("\n"),
  ];
  return joinText(lines);
}

function joinText(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join("\n\n");
}

function mapLines(record: Record<string, unknown>, ownerId: number, ownerKey: string): LineDraft[] {
  const lines: LineDraft[] = [];
  const seen = new Set<string>();
  const push = (line: LineDraft) => {
    let key = line.sf_key;
    if (seen.has(key)) key = `${key}:${seen.size}`;
    seen.add(key);
    lines.push({ ...line, sf_key: key });
  };

  asArray(record.services).forEach((item, index) => {
    const row = asRecord(item);
    if (!row) return;
    const sort = asNumber(row.item_index) ?? index;
    push({
      owner_sf_id: ownerId,
      sf_key: `${ownerKey}:service:${sort}`,
      kind: "service",
      name: asString(row.name) || "Service",
      description: asString(row.description),
      qty: asNumber(row.multiplier) ?? 1,
      rate_cents: dollarsToCents(row.rate),
      rate_percent: null,
      total_cents: dollarsToCents(row.total),
      cost_cents: dollarsToCents(row.cost),
      taxable: Boolean(asString(row.tax)),
      is_discount: false,
      is_percentage: false,
      sort_order: sort,
    });
  });

  asArray(record.products).forEach((item, index) => {
    const row = asRecord(item);
    if (!row) return;
    const sort = asNumber(row.item_index) ?? index;
    push({
      owner_sf_id: ownerId,
      sf_key: `${ownerKey}:product:${sort}`,
      kind: "product",
      name: asString(row.name) || "Product",
      description: asString(row.description),
      qty: asNumber(row.multiplier) ?? 1,
      rate_cents: dollarsToCents(row.rate),
      rate_percent: null,
      total_cents: dollarsToCents(row.total),
      cost_cents: dollarsToCents(row.cost),
      taxable: Boolean(asString(row.tax)),
      is_discount: false,
      is_percentage: false,
      sort_order: sort,
    });
  });

  asArray(record.other_charges).forEach((item, index) => {
    const row = asRecord(item);
    if (!row) return;
    const sort = asNumber(row.charge_index) ?? index;
    const percentage = asBoolean(row.is_percentage);
    push({
      owner_sf_id: ownerId,
      sf_key: `${ownerKey}:other:${sort}`,
      kind: "other_charge",
      name: asString(row.name) || "Other charge",
      description: "",
      qty: 1,
      rate_cents: percentage ? null : dollarsToCents(row.rate),
      rate_percent: percentage ? asNumber(row.rate) : null,
      total_cents: dollarsToCents(row.total),
      cost_cents: null,
      taxable: false,
      is_discount: asBoolean(row.is_discount),
      is_percentage: percentage,
      sort_order: sort,
    });
  });

  return lines;
}

function mapInvoice(
  invoice: Record<string, unknown>,
  id: number,
  jobSfId: number | null,
  customerSfId: number | null,
): InvoiceDraft {
  return {
    sf_id: id,
    job_sf_id: jobSfId,
    customer_sf_id: customerSfId,
    number: asString(invoice.number),
    invoice_date: timestampOrNull(invoice.date) ?? timestampOrNull(invoice.created_at),
    total_cents: dollarsToCents(invoice.total),
    is_paid: asBoolean(invoice.is_paid),
    terms: asString(invoice.terms) || asString(invoice.payment_terms),
    notes: asString(invoice.notes),
    currency: asString(invoice.currency) || "$",
    po_number: asString(invoice.po_number),
  };
}

function collectPayments(
  record: Record<string, unknown>,
  target: {
    ownerKey: string;
    jobSfId: number | null;
    estimateSfId: number | null;
    customerSfId: number | null;
    payments: PaymentDraft[];
    paymentKeys: Set<string>;
    notices: ImportNote[];
  },
) {
  asArray(record.payments).forEach((item, index) => {
    const row = asRecord(item);
    if (!row) return;
    const amount = dollarsToCents(row.amount);
    if (amount == null) {
      target.notices.push({
        table: "payments",
        sfId: target.ownerKey,
        reason: "payment_without_amount",
      });
      return;
    }
    const transactionId = asId(row.payment_transaction_id);
    const sfKey = transactionId != null ? `payment:${transactionId}` : `${target.ownerKey}:pay:${index}`;
    if (target.paymentKeys.has(sfKey)) {
      target.notices.push({ table: "payments", sfId: sfKey, reason: "duplicate_sf_id" });
      return;
    }
    target.paymentKeys.add(sfKey);
    target.payments.push({
      sf_id: transactionId,
      sf_key: sfKey,
      job_sf_id: target.jobSfId,
      invoice_sf_id: asId(row.invoice_id),
      estimate_sf_id: target.estimateSfId,
      customer_sf_id: target.customerSfId,
      amount_cents: amount,
      received_on: timestampOrNull(row.received_on) ?? timestampOrNull(row.created_at),
      memo: asString(row.memo),
      payment_type: asString(row.type),
      reference_number: asString(row.reference_number),
      apply_to: asString(row.apply_to),
      transaction_type: asString(row.transaction_type),
    });
  });
}

function techDirectoryFrom(techs: unknown[], jobs: Record<string, unknown>[]): Map<number, string> {
  const directory = new Map<number, string>();
  const add = (id: number | null, name: string) => {
    if (id != null && name && !directory.has(id)) directory.set(id, name);
  };
  for (const tech of techs) {
    const record = asRecord(tech);
    if (!record) continue;
    add(asId(record.id), personName(asString(record.first_name), asString(record.last_name)));
  }
  for (const job of jobs) {
    for (const tech of asArray(job.techs_assigned)) {
      const record = asRecord(tech);
      if (!record) continue;
      add(asId(record.id), personName(asString(record.first_name), asString(record.last_name)));
    }
  }
  return directory;
}

function techRefs(value: unknown, directory: Map<number, string>): TechRef[] {
  const refs: TechRef[] = [];
  for (const item of asArray(value)) {
    const record = asRecord(item);
    if (!record) continue;
    const sfId = asId(record.id);
    const name = personName(asString(record.first_name), asString(record.last_name))
      || (sfId != null ? directory.get(sfId) ?? "" : "");
    if (!name) continue;
    refs.push({ sfId, name });
  }
  return refs;
}

function refsFromIds(
  value: unknown,
  directory: Map<number, string>,
  notices: ImportNote[],
  taskId: number,
): TechRef[] {
  const refs: TechRef[] = [];
  for (const item of asArray(value)) {
    const id = asId(item);
    if (id == null) continue;
    const name = directory.get(id);
    if (!name) {
      notices.push({ table: "calendar_tasks", sfId: `${taskId}:${id}`, reason: "calendar_user_unknown" });
      continue;
    }
    refs.push({ sfId: id, name });
  }
  return refs;
}

function firstImportedId(value: unknown, allowed: Set<number>): number | null {
  for (const item of asArray(value)) {
    const id = asId(item);
    if (id != null && allowed.has(id)) return id;
  }
  return null;
}

function mapEquipment(
  record: Record<string, unknown>,
  customerId: number,
  index: number,
  bucket: Map<string, PropertyBuild>,
  customerNameById: Map<number, string>,
): EquipmentDraft {
  const type = asString(record.type);
  const make = asString(record.manufacturer) || asString(record.make);
  const serial = asString(record.serial_number);
  const equipId = asId(record.id);
  const sfKey = equipId != null
    ? `equip:${customerId}:${equipId}`
    : `equip:${customerId}:${stableHash(`${type}|${make}|${serial}|${index}`)}`;
  const matched = matchEquipmentProperty(record, bucket);
  let property = matched.key ? bucket.get([...bucket.values()].find((item) => item.sf_key === matched.key)?.matchKey ?? "") : undefined;
  if (!property && matched.key) {
    property = [...bucket.values()].find((item) => item.sf_key === matched.key);
  }
  if (!property) {
    const primary = [...bucket.values()].find((item) => item.isPrimary) ?? [...bucket.values()][0];
    if (primary) {
      property = primary;
    } else {
      const placeholder: PropertyBuild = {
        customer_sf_id: customerId,
        sf_key: `cust:${customerId}:primary`,
        matchKey: `primary:${customerId}`,
        name: customerNameById.get(customerId) || "Property",
        address: "",
        city: "",
        state: "",
        zip: "",
        formatted_address: "",
        latitude: null,
        longitude: null,
        type: "Residential",
        status: "Active",
        isPrimary: true,
      };
      bucket.set(placeholder.matchKey, placeholder);
      property = placeholder;
    }
  }
  const fieldLines = customFieldLines(record.custom_fields);
  const fieldMap: Record<string, string> = {};
  for (const line of fieldLines) {
    const splitAt = line.indexOf(":");
    if (splitAt > 0) fieldMap[line.slice(0, splitAt)] = line.slice(splitAt + 1).trim();
  }
  const systemName = [type, make].filter(Boolean).join(" – ") || "Equipment";
  return {
    sf_id: equipId,
    sf_key: sfKey,
    customer_sf_id: customerId,
    property_sf_key: property.sf_key,
    system_name: systemName,
    manufacturer: make,
    model_number: asString(record.model),
    serial_number: serial,
    install_date: asString(record.install_date),
    warranty_expiry: asString(record.warranty_date) || asString(record.extended_warranty_date),
    location: asString(record.location),
    property_name: property.name,
    customer_name: customerNameById.get(customerId) ?? "",
    lifecycle_status: "Active",
    match_state: matched.match,
    notes: joinText([asString(record.notes), fieldLines.join("\n")]),
    attributes: {
      sku: asString(record.sku),
      extended_warranty: asBoolean(record.is_extended_warranty),
      custom_fields: fieldMap,
    },
  };
}

function matchEquipmentProperty(
  record: Record<string, unknown>,
  bucket: Map<string, PropertyBuild>,
): { key: string | null; match: "exact" | "possible" | "unmatched" } {
  const location = record.customer_location;
  const asLocation = asRecord(location);
  if (asLocation) {
    const key = addressMatchKey(
      asString(asLocation.street_1),
      asString(asLocation.postal_code),
      asString(asLocation.city),
    );
    if (key && bucket.has(key)) return { key: bucket.get(key)?.sf_key ?? null, match: "exact" };
    const nickname = asString(asLocation.nickname).toLowerCase();
    if (nickname) {
      const named = [...bucket.values()].find((item) => item.name.toLowerCase() === nickname);
      if (named) return { key: named.sf_key, match: "possible" };
    }
  }
  if (typeof location === "string" && location.trim()) {
    const named = [...bucket.values()].find((item) => item.name.toLowerCase() === location.trim().toLowerCase());
    if (named) return { key: named.sf_key, match: "possible" };
  }
  const primary = [...bucket.values()].find((item) => item.isPrimary) ?? [...bucket.values()][0];
  return { key: primary?.sf_key ?? null, match: "unmatched" };
}
