/**
 * Documents API — portal project document management.
 *
 * Maps to the `portal_memberships` table which governs what documents
 * are shared with external portal users per project.
 *
 * GET  /api/documents — list accessible document memberships
 *   Allowed: owner, manager, portal (own rows via RLS)
 *
 * POST /api/documents — create a document access record
 *   Allowed: owner, manager only
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { emitAuditEvent } from "@/lib/audit";
import { createRepositoryErrorBody } from "@/lib/repositories/http";
import { createDocumentsService } from "@/services/domain/documentsService";
import type { PortalDocumentAccess } from "@/services/repositories/documentsRepository";

const documentsService = createDocumentsService();

export async function GET(request: Request) {
  const guard = requirePermission(request, "portal_memberships", "select");
  if (!guard.ok) return guard.response;

  const result = await documentsService.list();
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ documents: result.data.items });
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "portal_memberships", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "Request body must be valid JSON.", code: 400 },
      { status: 400 },
    );
  }

  emitAuditEvent({
    role: guard.ctx.role,
    action: "create",
    resource: "documents",
    details: { projectId: body.projectId },
  });

  const result = await documentsService.create(body as Partial<PortalDocumentAccess>);
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ message: "Document access created.", document: result.data }, { status: 201 });
}
