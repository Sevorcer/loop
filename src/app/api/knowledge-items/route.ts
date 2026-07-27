/**
 * Knowledge Items API — Sprint 27 #58/#59
 *
 * GET /api/knowledge-items  — return full knowledge snapshot
 *   (items + relationships + usage) for the CompanyBrainProvider.
 *
 * POST /api/knowledge-items — create a new knowledge item.
 *
 * Access: all internal staff roles
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import {
  VALID_KNOWLEDGE_STATUSES,
  VALID_KNOWLEDGE_TYPES,
} from "@/lib/constants/knowledge";
import { createKnowledgeItem, getKnowledgeSnapshot } from "@/services/knowledgeItems";
import type {
  KnowledgeRelatedDomain,
  KnowledgeStatus,
  KnowledgeType,
} from "@/features/company-brain/types/knowledgeItem";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "knowledge_items", "select");
  if (!guard.ok) return guard.response;

  try {
    const snapshot = await getKnowledgeSnapshot();
    return NextResponse.json({ snapshot });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "knowledge_items", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const bodyText = typeof body.body === "string" ? body.body.trim() : "";
    const knowledgeType = typeof body.knowledgeType === "string" ? body.knowledgeType : "";
    const status =
      typeof body.status === "string" && VALID_KNOWLEDGE_STATUSES.has(body.status)
        ? (body.status as KnowledgeStatus)
        : "draft";

    if (!title) {
      return NextResponse.json(
        { error: "VALIDATION", message: "title is required.", code: 400 },
        { status: 400 },
      );
    }
    if (!VALID_KNOWLEDGE_TYPES.has(knowledgeType)) {
      return NextResponse.json(
        { error: "VALIDATION", message: "Invalid knowledgeType.", code: 400 },
        { status: 400 },
      );
    }

    const tags = Array.isArray(body.tags)
      ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string")
      : [];

    const relatedDomains = Array.isArray(body.relatedDomains)
      ? (body.relatedDomains as unknown[]).filter((d): d is KnowledgeRelatedDomain =>
          typeof d === "string",
        )
      : [];

    const item = await createKnowledgeItem({
      title,
      summary,
      body: bodyText,
      knowledgeType: knowledgeType as KnowledgeType,
      status,
      tags,
      owner: typeof body.owner === "string" ? body.owner.trim() : "Team",
      relatedDomains,
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "knowledge_items",
      resourceId: item.id,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
