import "server-only";

import {
  assertDateRange,
  computeProductionReport,
  redactProductionReport,
  type ProductionReport,
} from "@/features/reporting/utils/productionReport";
import { canSeeJobRevenue } from "@/features/reporting/utils/revenueAccess";
import { companyTimeZone } from "@/lib/timezone";
import { listProductionSources } from "@/repositories/productionReport";
import type { AppRole } from "@/services/authorization";

export async function getProductionReport(
  role: AppRole,
  from: string,
  to: string,
): Promise<ProductionReport> {
  const range = assertDateRange(from, to);
  const includeRevenue = canSeeJobRevenue(role);
  const source = await listProductionSources(includeRevenue);
  const report = computeProductionReport(source.jobs, source.completions, range, companyTimeZone());
  return includeRevenue ? report : redactProductionReport(report);
}
