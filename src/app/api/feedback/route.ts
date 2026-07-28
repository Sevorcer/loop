/**
 * Feedback Reports API
 *
 * GET  /api/feedback  — list reports (manager/owner only)
 * POST /api/feedback  — submit a feedback report (all operational staff)
 *
 * POST accepts either:
 *   - application/json (no screenshot)
 *   - multipart/form-data (with optional screenshot)
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import { uploadFile } from "@/repositories/storage";
import type { FeedbackSeverity, FeedbackStatus } from "@/features/feedback/types/feedbackReport";
import {
  createFeedbackReport,
  listFeedbackReports,
} from "@/services/feedbackReports";

const FEEDBACK_SCREENSHOTS_BUCKET = "feedback-screenshots";
const MAX_SCREENSHOT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_SCREENSHOT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeScreenshotName(name: string): string {
  const trimmed = name.trim();
  const ext = /\.([a-zA-Z0-9]{1,10})$/.exec(trimmed);
  const extension = ext ? `.${ext[1].toLowerCase()}` : ".jpg";
  const base = ext ? trimmed.slice(0, -extension.length) : trimmed;
  const safe = base
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "screenshot";
  return `${safe}${extension}`;
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "feedback_reports", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as FeedbackStatus | null;
  const severity = url.searchParams.get("severity") as FeedbackSeverity | null;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  try {
    const reports = await listFeedbackReports({
      status: status ?? undefined,
      severity: severity ?? undefined,
      from,
      to,
    });
    return NextResponse.json({ reports });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "feedback_reports", "insert");
  if (!guard.ok) return guard.response;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    let screenshotUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = {
        severity: formData.get("severity"),
        intendedAction: formData.get("intendedAction"),
        actualResult: formData.get("actualResult"),
        routePath: formData.get("routePath"),
        contextJobId: formData.get("contextJobId"),
        contextCustomerId: formData.get("contextCustomerId"),
        contextPropertyId: formData.get("contextPropertyId"),
      };

      const screenshot = formData.get("screenshot");
      if (screenshot instanceof File && screenshot.size > 0) {
        const mimeType = screenshot.type.toLowerCase() || "image/jpeg";
        const normalizedType = mimeType === "image/jpg" ? "image/jpeg" : mimeType;

        if (!ALLOWED_SCREENSHOT_TYPES.has(normalizedType)) {
          return createApiErrorResponse(
            "VALIDATION_ERROR",
            "Screenshot must be a JPEG, PNG, or WebP image.",
            400,
          );
        }

        if (screenshot.size > MAX_SCREENSHOT_SIZE_BYTES) {
          return createApiErrorResponse(
            "VALIDATION_ERROR",
            "Screenshot must be smaller than 10 MB.",
            400,
          );
        }

        const fileName = normalizeScreenshotName(screenshot.name || "screenshot.jpg");
        const storagePath = `feedback/${randomUUID()}-${fileName}`;
        const bytes = new Uint8Array(await screenshot.arrayBuffer());

        const uploaded = await uploadFile({
          bucket: FEEDBACK_SCREENSHOTS_BUCKET,
          storagePath,
          fileName,
          mimeType: normalizedType,
          sizeBytes: screenshot.size,
          file: bytes,
          visibility: "internal",
          uploadedBy: guard.ctx.userId || null,
        });

        screenshotUrl = uploaded.storagePath;
      }
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }

    const report = await createFeedbackReport(
      {
        severity: String(body.severity ?? "") as FeedbackSeverity,
        intendedAction: String(body.intendedAction ?? "").trim(),
        actualResult: String(body.actualResult ?? "").trim(),
        routePath: String(body.routePath ?? "").trim(),
        contextJobId: body.contextJobId ? String(body.contextJobId) : null,
        contextCustomerId: body.contextCustomerId ? String(body.contextCustomerId) : null,
        contextPropertyId: body.contextPropertyId ? String(body.contextPropertyId) : null,
        screenshotUrl,
      },
      {
        userId: guard.ctx.userId,
        role: guard.ctx.role,
      },
    );

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/feedback", request }, error);
    return mapRouteError(error);
  }
}
