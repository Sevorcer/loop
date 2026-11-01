import { addCalendarDays, todayInCompanyTimeZone } from "../timezone";

import {
  SF_IMPORT_CUTOFF_DATE,
  SF_IMPORT_TIME_ZONE,
  SF_JOB_NUMBER_PREFIX,
  SF_STALE_OPEN_DAYS,
  type SfImportOptions,
} from "./constants";
import { asString, dateOnly, normalizeLabel } from "./json";
import { isSfJobClosed } from "./status";

export function resolveImportOptions(partial?: Partial<SfImportOptions>): SfImportOptions {
  return {
    cutoffDate: partial?.cutoffDate ?? SF_IMPORT_CUTOFF_DATE,
    staleOpenDays: partial?.staleOpenDays ?? SF_STALE_OPEN_DAYS,
    asOfDate: partial?.asOfDate ?? todayInCompanyTimeZone(),
    timeZone: partial?.timeZone ?? SF_IMPORT_TIME_ZONE,
    jobNumberPrefix: partial?.jobNumberPrefix ?? SF_JOB_NUMBER_PREFIX,
  };
}

/** The first day that is NOT more than staleOpenDays before the run date. */
export function staleOpenCutoff(options: SfImportOptions): string {
  return addCalendarDays(options.asOfDate, -options.staleOpenDays);
}

export type JobScope =
  | { include: true }
  | { include: false; reason: "undated_open_job" | "stale_open_job" | "out_of_scope_before_cutoff" };

/**
 * A job is in the window when its start date is on or after the cutoff.
 * Undated open jobs stay in Service Fusion. Open jobs dated more than
 * staleOpenDays before the run date stay there too. Newer open jobs, and
 * future open jobs, are imported.
 * "Open" includes the Service Fusion status Completed (work done, not invoiced yet).
 */
export function jobScopeDecision(
  job: { status?: unknown; start_date?: unknown },
  options: SfImportOptions = resolveImportOptions(),
): JobScope {
  const open = !isSfJobClosed(asString(job.status));
  const start = dateOnly(job.start_date);
  const staleBefore = staleOpenCutoff(options);

  if (open && !start) return { include: false, reason: "undated_open_job" };
  if (open && start && start < staleBefore) {
    return { include: false, reason: "stale_open_job" };
  }
  if (!start || start < options.cutoffDate) {
    return { include: false, reason: "out_of_scope_before_cutoff" };
  }
  return { include: true };
}

export function recordOnOrAfter(value: unknown, cutoffDate: string): boolean {
  const day = dateOnly(value);
  return Boolean(day && day >= cutoffDate);
}

export function parentRef(
  value: unknown,
): { kind: "none" } | { kind: "id"; id: number } | { kind: "name"; name: string } {
  if (value == null || value === "") return { kind: "none" };
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return { kind: "id", id: value };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { kind: "none" };
    if (/^\d+$/.test(trimmed)) return { kind: "id", id: Number(trimmed) };
    return { kind: "name", name: trimmed };
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const idValue = record.id;
    if (typeof idValue === "number" && Number.isInteger(idValue) && idValue > 0) {
      return { kind: "id", id: idValue };
    }
    if (typeof idValue === "string" && /^\d+$/.test(idValue.trim())) {
      return { kind: "id", id: Number(idValue.trim()) };
    }
    const name = asString(record.customer_name) || asString(record.name);
    if (name) return { kind: "name", name };
  }
  return { kind: "none" };
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function assertImportOptions(options: SfImportOptions): void {
  if (!isIsoDate(options.cutoffDate)) {
    throw new Error("Cutoff must be a date like 2024-11-01.");
  }
  if (!isIsoDate(options.asOfDate)) {
    throw new Error("The import date must be a date like 2026-11-01.");
  }
  if (!Number.isInteger(options.staleOpenDays) || options.staleOpenDays < 0) {
    throw new Error("The open-job window must be a number of days, 0 or more.");
  }
  if (normalizeLabel(options.jobNumberPrefix).length === 0) {
    throw new Error("Job number prefix cannot be blank.");
  }
}
