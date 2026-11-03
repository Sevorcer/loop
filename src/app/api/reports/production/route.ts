import { NextResponse } from "next/server";

import {
  PRODUCTION_JOBS_PAGE_SIZE,
  companyPresetRange,
  productionReportToCsv,
} from "@/features/reporting/utils/productionReport";
import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getProductionReport, getProductionReportPage } from "@/services/productionReport";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const fallback = companyPresetRange("this-month");
    const from = url.searchParams.get("from") || fallback.from;
    const to = url.searchParams.get("to") || fallback.to;

    // CSV is a full export, built server-side from the whole report so the
    // spreadsheet is never a partial page.
    if (url.searchParams.get("format") === "csv") {
      const report = await getProductionReport(guard.ctx.role, from, to);
      const body = productionReportToCsv(report);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="production-${report.from}-to-${report.to}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    // The screen reads a compact, paged view: full totals/teams/people plus
    // one window of the jobs list, instead of every completed job row.
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(
      url.searchParams.get("pageSize"),
      PRODUCTION_JOBS_PAGE_SIZE,
    );
    const report = await getProductionReportPage(guard.ctx.role, from, to, page, pageSize);
    return NextResponse.json({ report });
  } catch (error) {
    return mapRouteError(error);
  }
}
