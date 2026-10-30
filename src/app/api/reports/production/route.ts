import { NextResponse } from "next/server";

import { productionReportToCsv } from "@/features/reporting/utils/productionReport";
import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { todayInCompanyTimeZone } from "@/lib/timezone";
import { monthRangeContaining } from "@/features/reporting/utils/productionReport";
import { getProductionReport } from "@/services/productionReport";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const today = todayInCompanyTimeZone();
    const fallback = monthRangeContaining(today);
    const from = url.searchParams.get("from") || fallback.from;
    const to = url.searchParams.get("to") || fallback.to;
    const report = await getProductionReport(guard.ctx.role, from, to);

    if (url.searchParams.get("format") === "csv") {
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

    return NextResponse.json({ report });
  } catch (error) {
    return mapRouteError(error);
  }
}
