import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import {
  markBilled,
  unmarkBilled,
  excludeFromBilling,
  unexcludeFromBilling,
} from "@/services/billing";

const VALID_ACTIONS = new Set(["mark_billed", "unmark_billed", "exclude", "unexclude"]);

export async function POST(request: Request) {
  // Billing actions require office-level update permission on jobs.
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  try {
    const body = await readJsonObject(request);
    const action = String(body.action ?? "");
    const jobId = String(body.jobId ?? "").trim();

    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${Array.from(VALID_ACTIONS).join(", ")}.` },
        { status: 400 },
      );
    }

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    let success = false;

    switch (action) {
      case "mark_billed": {
        const qbInvoiceNumber = String(body.qbInvoiceNumber ?? "").trim();
        const billedAt = String(body.billedAt ?? "").trim();
        if (!qbInvoiceNumber) {
          return NextResponse.json(
            { error: "qbInvoiceNumber is required." },
            { status: 400 },
          );
        }
        if (!billedAt) {
          return NextResponse.json(
            { error: "billedAt is required." },
            { status: 400 },
          );
        }
        success = await markBilled(
          { jobId, qbInvoiceNumber, billedAt },
          guard.ctx.userId,
        );
        break;
      }
      case "unmark_billed":
        success = await unmarkBilled(jobId);
        break;
      case "exclude":
        success = await excludeFromBilling(jobId);
        break;
      case "unexclude":
        success = await unexcludeFromBilling(jobId);
        break;
    }

    return NextResponse.json({ success });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}
