"use client";

import { JobMaterialsProvider } from "../state/JobMaterialsProvider";
import { JobTechnicalDataProvider } from "../state/JobTechnicalDataProvider";
import type { JobMaterialSummary } from "../types/jobMaterials";
import { JobMaterialsPanel } from "./JobMaterialsPanel";
import { JobTechnicalDataPanel } from "./JobTechnicalDataPanel";

/**
 * Compact Materials + Technical data pair for the Dispatch board card.
 * Mounted only when the card is expanded, so the board itself makes no
 * extra requests per card.
 */
export function JobPrepPanels({
  jobId,
  onMaterialsSummary,
}: {
  jobId: string;
  onMaterialsSummary?: (summary: JobMaterialSummary) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <JobMaterialsProvider jobId={jobId} onSummaryChange={onMaterialsSummary}>
        <JobMaterialsPanel compact />
      </JobMaterialsProvider>
      <JobTechnicalDataProvider jobId={jobId}>
        <JobTechnicalDataPanel compact />
      </JobTechnicalDataProvider>
    </div>
  );
}
