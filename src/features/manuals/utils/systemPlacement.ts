/**
 * "Auto-placed" info for an installed system (#32). Pure.
 *
 * Shows where the record's facts came from: the nameplate fields on the
 * record, technical custom fields from the import (filter / belt sizes …),
 * and the job it belongs to — the linked job when installed_systems.job_id
 * is set, otherwise the same-property Install job closest to the install
 * date, otherwise the latest Install job at the property (labelled as such).
 *
 * Live (Nov 4): 0 of 2,778 systems have job_id; 2,671 have jobs at their
 * property; 713 have an ISO install date. Custom fields can hold PII
 * ("Retail Space Customer"), so only technical keys are shown.
 */

import type { SystemPlacement, SystemPlacementJob } from "../types/manuals";

export interface PlacementSystemInput {
  manufacturer: string | null;
  modelNumber: string | null;
  serialNumbers: string[];
  installDate: string | null;
  location: string | null;
  systemName: string;
  jobId: string | null;
  attributes: Record<string, unknown> | null;
}

export interface PlacementJobInput {
  id: string;
  jobNumber: string | null;
  title: string | null;
  type: string | null;
  status: string | null;
  scheduledFor: string | null;
}

const TECHNICAL_KEY = /filter|belt|refrigerant|charge|tonnage|\btons?\b|voltage|amps?\b|breaker|fuse|btu|seer|equipment information|size/i;
const PII_KEY = /customer|tenant|owner|name|phone|email|address|contact|gate|lock|code|alarm|password|key|space/i;

export function technicalRecordFields(attributes: Record<string, unknown> | null): Array<{ label: string; value: string }> {
  const custom = attributes && typeof attributes === "object" ? (attributes as { custom_fields?: unknown }).custom_fields : null;
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const [key, raw] of Object.entries(custom as Record<string, unknown>)) {
    if (!TECHNICAL_KEY.test(key) || PII_KEY.test(key)) continue;
    const value = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
    if (!value) continue;
    // Belt-and-braces: never show something that looks like contact info.
    if (/@|\d{3}[-. )]\s?\d{3}[-. ]\d{4}/.test(value)) continue;
    out.push({ label: key.trim(), value: value.slice(0, 200) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const DAY = 86_400_000;
export const INSTALL_DATE_WINDOW_DAYS = 60;

function toJob(row: PlacementJobInput, basis: SystemPlacementJob["basis"]): SystemPlacementJob {
  return {
    id: row.id,
    jobNumber: row.jobNumber ?? "",
    title: row.title ?? "",
    type: row.type ?? "",
    status: row.status ?? "",
    scheduledFor: row.scheduledFor ?? null,
    basis,
  };
}

export function pickPlacementJob(
  system: Pick<PlacementSystemInput, "installDate">,
  linkedJob: PlacementJobInput | null,
  propertyInstallJobs: PlacementJobInput[],
): SystemPlacementJob | null {
  if (linkedJob) return toJob(linkedJob, "linked");
  if (propertyInstallJobs.length === 0) return null;
  if (system.installDate && ISO_DATE.test(system.installDate)) {
    const installed = Date.parse(system.installDate.slice(0, 10));
    let best: { job: PlacementJobInput; gap: number } | null = null;
    for (const job of propertyInstallJobs) {
      if (!job.scheduledFor) continue;
      const gap = Math.abs(Date.parse(job.scheduledFor.slice(0, 10)) - installed) / DAY;
      if (!Number.isFinite(gap) || gap > INSTALL_DATE_WINDOW_DAYS) continue;
      if (!best || gap < best.gap) best = { job, gap };
    }
    if (best) return toJob(best.job, "install_date");
  }
  const latest = [...propertyInstallJobs].sort((a, b) => (b.scheduledFor ?? "").localeCompare(a.scheduledFor ?? ""))[0];
  return toJob(latest, "latest_install");
}

export function buildSystemPlacement(
  system: PlacementSystemInput,
  linkedJob: PlacementJobInput | null,
  propertyInstallJobs: PlacementJobInput[],
): SystemPlacement {
  const nameplate: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (v && v.toLowerCase() !== "unknown") nameplate.push({ label, value: v });
  };
  push("Manufacturer", system.manufacturer);
  push("Model", system.modelNumber);
  push("Serial", system.serialNumbers.filter((s) => s.trim()).join(", "));
  push("Installed", system.installDate);
  push("Location", system.location);
  return {
    nameplate,
    recordFields: technicalRecordFields(system.attributes),
    job: pickPlacementJob(system, linkedJob, propertyInstallJobs),
  };
}
