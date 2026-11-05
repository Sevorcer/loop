import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { getGcLedgerEntries, createGcLedgerEntry } from "@/services/gcLedger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "gc_ledger_entries", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const entries = await getGcLedgerEntries(id);
    return NextResponse.json({ entries });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "gc_ledger_entries", "insert");
  if (!guard.ok) return guard.response;

  try {
    await params; // validate route param exists
    const body = await readJsonObject(request);
    const entry = await createGcLedgerEntry({
      jobId: String(body.jobId ?? ""),
      estimateNumber: body.estimateNumber as string | undefined,
      gcPoNumber: body.gcPoNumber as string | undefined,
      dateSent: body.dateSent as string | null | undefined,
      dateReceived: body.dateReceived as string | null | undefined,
      balanceCents: body.balanceCents as number | undefined,
      retainerCents: body.retainerCents as number | undefined,
      notes: body.notes as string | undefined,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
