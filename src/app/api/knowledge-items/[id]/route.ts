/**
 * Individual knowledge item operations.
 *
 * GET   /api/knowledge-items/[id]
 * PATCH /api/knowledge-items/[id] — update fields or archive
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import {
  getKnowledgeItem,
  updateKnowledgeItem,
} from "@/services/knowledgeItems";
import type {
  KnowledgeRelatedDomain,
  KnowledgeStatus,
  KnowledgeType,
} from "@/features/company-brain/types/knowledgeItem";

const VALID_TYPES = new Set<string>([
  "sop",
  "installation_guide",
  "service_bulletin",
  "troubleshooting",
  "safety_procedure",
  "best_practice",
  "policy",
  "training",
  "faq",
]);

const VALID_STATUSES = new Set<string>([
  "draft",
  "reviewed",
  "published",
  "improved",
  "archived",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "knowledge_items", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const item = await getKnowledgeItem(id);
    if (!item) {
      return createApiErrorResponse("NOT_FOUND", `Knowledge item ${id} not found.`, 404);
    }
    return NextResponse.json({ item });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "knowledge_items", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const { id } = await params;

  try {
    const patch: Parameters<typeof updateKnowledgeItem>[1] = {};

    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.summary === "string") patch.summary = body.summary.trim();
    if (typeof body.body === "string") patch.body = body.body.trim();
    if (typeof body.owner === "string") patch.owner = body.owner.trim();

    if (typeof body.knowledgeType === "string" && VALID_TYPES.has(body.knowledgeType)) {
      patch.knowledgeType = body.knowledgeType as KnowledgeType;
    }

    if (typeof body.status === "string" && VALID_STATUSES.has(body.status)) {
      patch.status = body.status as KnowledgeStatus;
    }

    if (Array.isArray(body.tags)) {
      patch.tags = (body.tags as unknown[]).filter((t): t is string => typeof t === "string");
    }

    if (Array.isArray(body.relatedDomains)) {
      patch.relatedDomains = (body.relatedDomains as unknown[]).filter(
        (d): d is KnowledgeRelatedDomain => typeof d === "string",
      );
    }

    const updated = await updateKnowledgeItem(id, patch);

    if (!updated) {
      return createApiErrorResponse("NOT_FOUND", `Knowledge item ${id} not found.`, 404);
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "knowledge_items",
      resourceId: id,
      details: { status: patch.status },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    return mapRouteError(error);
  }
}
