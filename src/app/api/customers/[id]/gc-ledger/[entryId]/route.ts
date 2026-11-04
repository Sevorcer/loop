import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { updateGcLedgerEntry, deleteGcLedgerEntry, getGcLedgerEntry } from "@/services/gcLedger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const guard = await requirePermission(request, "gc_ledger_entries", "select");
  if (!guard.ok) return guard.response;

  try {
    const { entryId } = await params;
    const entry = await getGcLedgerEntry(entryId);

    if (!entry) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Ledger entry not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const guard = await requirePermission(request, "gc_ledger_entries", "update");
  if (!guard.ok) return guard.response;

  try {
    const { entryId } = await params;
    const body = await readJsonObject(request);
    const entry = await updateGcLedgerEntry(entryId, {
      estimateNumber: body.estimateNumber as string | undefined,
      gcPoNumber: body.gcPoNumber as string | undefined,
      dateSent: body.dateSent as string | null | undefined,
      dateReceived: body.dateReceived as string | null | undefined,
      balanceCents: body.balanceCents as number | undefined,
      retainerCents: body.retainerCents as number | undefined,
      notes: body.notes as string | undefined,
    });

    if (!entry) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Ledger entry not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const guard = await requirePermission(request, "gc_ledger_entries", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { entryId } = await params;
    await deleteGcLedgerEntry(entryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
