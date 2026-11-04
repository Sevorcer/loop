import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listAllInspections } from "@/services/jobInspections";
export async function GET(request: Request) { const guard = await requirePermission(request, "job_inspections", "select"); if (!guard.ok) return guard.response; try { const inspections = await listAllInspections(); return NextResponse.json({ inspections }); } catch (error) { return mapRouteError(error); } }
