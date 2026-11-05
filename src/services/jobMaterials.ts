import "server-only";

import type {
  JobMaterialCreateInput,
  JobMaterialLine,
  JobMaterialPatchInput,
  JobMaterialSummary,
  JobTechnicalData,
} from "@/features/job-materials/types/jobMaterials";
import { buildJobTechnicalData, knowledgeSearchTokens } from "@/features/job-materials/utils/technicalData";
import {
  createJobMaterialLine,
  deleteJobMaterialLine,
  listJobMaterialLines,
  nextJobMaterialSortOrder,
  summarizeJobMaterialsForJobs,
  updateJobMaterialLine,
} from "@/repositories/jobMaterials";
import {
  countSystemsForProperties,
  listKnowledgeForEquipment,
  listTechnicalProfilesByIds,
  listTechnicalSystemsForJob,
  loadJobTechnicalAnchor,
} from "@/repositories/jobTechnicalData";

// ---------------------------------------------------------------------------
// Materials
//
// Inventory hook (bundlec-note-inventory.md phase 2): updateJobMaterial is the
// one place a state transition happens. When stock locations land, a
// needed→on_truck move records a shop→truck transfer and on_truck→used a
// consume, in the same call — the routes and UI do not change.
// ---------------------------------------------------------------------------

export async function getJobMaterials(jobId: string): Promise<JobMaterialLine[]> {
  return listJobMaterialLines(jobId);
}

export async function addJobMaterial(
  jobId: string,
  input: JobMaterialCreateInput,
): Promise<JobMaterialLine> {
  const sortOrder = await nextJobMaterialSortOrder(jobId);
  return createJobMaterialLine(jobId, input, sortOrder);
}

export async function updateJobMaterial(
  jobId: string,
  lineId: string,
  patch: JobMaterialPatchInput,
): Promise<JobMaterialLine> {
  return updateJobMaterialLine(jobId, lineId, patch);
}

export async function removeJobMaterial(jobId: string, lineId: string): Promise<void> {
  return deleteJobMaterialLine(jobId, lineId);
}

export async function getJobMaterialSummaries(
  jobIds: ReadonlyArray<string>,
): Promise<Record<string, JobMaterialSummary>> {
  return summarizeJobMaterialsForJobs(jobIds);
}

// ---------------------------------------------------------------------------
// Technical data
// ---------------------------------------------------------------------------

/** null → the job does not exist or the caller cannot see it. */
export async function getJobTechnicalData(jobId: string): Promise<JobTechnicalData | null> {
  const anchor = await loadJobTechnicalAnchor(jobId);
  if (!anchor) return null;

  const systems = await listTechnicalSystemsForJob(anchor.id, anchor.propertyId);
  const tokens = knowledgeSearchTokens(systems);
  const [profiles, knowledge] = await Promise.all([
    listTechnicalProfilesByIds(
      systems.map((system) => system.technicalProfileId).filter((id): id is string => !!id),
    ),
    listKnowledgeForEquipment({
      jobId: anchor.id,
      systemIds: systems.map((system) => system.id),
      tags: tokens.tags,
      titleModels: tokens.titleModels,
    }),
  ]);

  return buildJobTechnicalData({
    jobId: anchor.id,
    propertyId: anchor.propertyId,
    systems,
    profiles,
    knowledge: knowledge.items,
    links: knowledge.links,
  });
}

export async function getSystemCountsForProperties(propertyIds: ReadonlyArray<string>) {
  return countSystemsForProperties(propertyIds);
}
