import type { JobMaterialSummary } from "@/features/job-materials/types/jobMaterials";
import { materialReadinessFromSummary } from "@/features/job-materials/utils/jobMaterials";
import { technicalReadinessFromCounts } from "@/features/job-materials/utils/technicalData";

import type { DispatchSnapshot } from "../types/dispatch";
import { deriveIsDispatchable } from "./dispatchUtils";

/**
 * #23: the board's Materials and Technical chips were stored jsonb that
 * nothing ever wrote — every live plan (3,598) read "not_satisfied", so
 * every card showed two red chips. Replace them at read time with what the
 * job actually has: its materials list and the equipment on file at its
 * property. Display only — dispatch_plans is not written and the board's
 * grouping (by dispatchStatus) does not change.
 */
export function applyPrepReadiness(
  snapshot: DispatchSnapshot,
  input: {
    materialSummaries: Readonly<Record<string, JobMaterialSummary>>;
    /** job id → property id */
    jobPropertyIds: Readonly<Record<string, string | null | undefined>>;
    /** property id → system counts */
    systemCounts: Readonly<Record<string, { systems: number; withProfile: number }>>;
  },
): DispatchSnapshot {
  return {
    ...snapshot,
    dispatchPlans: snapshot.dispatchPlans.map((plan) => {
      if (!plan.jobId) return plan;
      const summary = input.materialSummaries[plan.jobId];
      const propertyId = input.jobPropertyIds[plan.jobId];
      const counts = propertyId ? input.systemCounts[propertyId] : undefined;
      const materialReadiness = summary
        ? materialReadinessFromSummary(summary)
        : plan.dispatchability.materialReadiness;
      const technicalReadiness =
        propertyId === undefined
          ? plan.dispatchability.technicalReadiness
          : technicalReadinessFromCounts(counts ?? { systems: 0, withProfile: 0 });
      const dispatchability = {
        ...plan.dispatchability,
        materialReadiness,
        technicalReadiness,
      };
      return {
        ...plan,
        dispatchability: {
          ...dispatchability,
          isDispatchable: deriveIsDispatchable(dispatchability),
        },
      };
    }),
  };
}
