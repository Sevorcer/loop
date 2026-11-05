import "server-only";

import {
  assertDateRange,
  computeProductionReport,
  pageOfProductionReport,
  redactProductionReport,
  type ProductionReport,
  type ProductionReportPage,
} from "@/features/reporting/utils/productionReport";
import { companyTimeZone } from "@/lib/timezone";
import { listProductionSources } from "@/repositories/productionReport";
import type { AppRole } from "@/services/authorization";
import {
  canSeeFinancials,
  getFinancialsVisibility,
} from "@/services/orgSettings";

export async function getProductionReport(
  role: AppRole,
  from: string,
  to: string,
): Promise<ProductionReport> {
  const range = assertDateRange(from, to);
  // Revenue totals follow the org's financial-visibility setting
  // (owner-only by default — Collin, 2026-11-04).
  const includeRevenue = canSeeFinancials(role, await getFinancialsVisibility());
  const source = await listProductionSources(includeRevenue);
  const report = computeProductionReport(source.jobs, source.completions, range, companyTimeZone());
  return includeRevenue ? report : redactProductionReport(report);
}

/**
 * Same report, delivered as a page: the compact totals/teams/people plus one
 * window of the jobs list. The full report is computed exactly as above (so
 * every figure and definition is identical), then sliced — this is the shape
 * the reporting screen fetches so the first payload stays small and the page
 * is interactive in seconds instead of shipping thousands of job rows.
 */
export async function getProductionReportPage(
  role: AppRole,
  from: string,
  to: string,
  page = 1,
  pageSize?: number,
): Promise<ProductionReportPage> {
  const report = await getProductionReport(role, from, to);
  return pageOfProductionReport(report, page, pageSize);
}
