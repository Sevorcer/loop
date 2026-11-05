import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { rescheduleJobByDayShift } from "@/services/dispatch";

/**
 * POST /api/jobs/[id]/reschedule — shift a job (and its dispatch plan) to a
 * new day. Used by the calendar drag-to-reschedule so that dispatch-plan
 * schedule blocks move with the job.
 *
 * Body: { grabDay: "YYYY-MM-DD", dropDay: "YYYY-MM-DD" }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermission(request, "jobs", "update");
    if (!guard.ok) return guard.response;
    const { id } = await params;
    const body = await readJsonObject(request);

    const grabDay = String(body.grabDay ?? "");
    const dropDay = String(body.dropDay ?? "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(grabDay) || !/^\d{4}-\d{2}-\d{2}$/.test(dropDay)) {
      return NextResponse.json(
        { error: "grabDay and dropDay must be YYYY-MM-DD date strings." },
        { status: 400 },
      );
    }

    await rescheduleJobByDayShift(id, grabDay, dropDay);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
