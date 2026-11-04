import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listActivePermits } from "@/services/jobPermits";
export async function GET(request: Request) { const guard = await requirePermission(request, "job_permits", "select"); if (!guard.ok) return guard.response; try { const permits = await listActivePermits(); return NextResponse.json({ permits }); } catch (error) { return mapRouteError(error); } }
