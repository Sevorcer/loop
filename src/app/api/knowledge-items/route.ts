/**
 * Knowledge Items API — Sprint 27 #58/#59
 *
 * GET /api/knowledge-items  — return full knowledge snapshot
 *   (items + relationships + usage) for the CompanyBrainProvider.
 *
 * Access: all internal staff roles
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getKnowledgeSnapshot } from "@/services/knowledgeItems";

export async function GET(request: Request) {
  const guard = requirePermission(request, "knowledge_items", "select");
  if (!guard.ok) return guard.response;

  try {
    const snapshot = await getKnowledgeSnapshot();
    return NextResponse.json({ snapshot });
  } catch (error) {
    return mapRouteError(error);
  }
}
