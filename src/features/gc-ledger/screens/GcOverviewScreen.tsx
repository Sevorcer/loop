"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { GcBuilderRollup } from "../types/gcLedger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GcOverviewScreen() {
  const [builders, setBuilders] = useState<GcBuilderRollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuilders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gc-overview");
      if (!res.ok) throw new Error("Failed to fetch");
      const { builders: data } = await res.json();
      setBuilders(data ?? []);
    } catch {
      setError("Failed to load builder overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuilders();
  }, [fetchBuilders]);

  // Grand totals
  const grandBilled = builders.reduce((sum, b) => sum + b.totalBilledCents, 0);
  const grandOutstanding = builders.reduce((sum, b) => sum + b.totalOutstandingCents, 0);
  const grandRetainer = builders.reduce((sum, b) => sum + b.totalRetainerCents, 0);
  const grandCallbacks = builders.reduce((sum, b) => sum + b.callbackCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GC Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Builder billing summary across all active general contractors.
        </p>
      </div>

      {/* Grand totals */}
      {!loading && builders.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Billed
              </p>
              <p className="mt-1 text-xl font-semibold text-primary">
                {formatCents(grandBilled)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Outstanding
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-400">
                {formatCents(grandOutstanding)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Retainer Held
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatCents(grandRetainer)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Open Callbacks
              </p>
              <p className="mt-1 text-xl font-semibold">
                {grandCallbacks}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Loading / error / empty states */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border bg-card p-12 text-muted-foreground">
          Loading builders...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-card p-6 text-sm text-destructive">
          {error}
        </div>
      ) : builders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-12 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No builders found. Builders appear here when a parent customer has child customers with jobs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Builder</th>
                <th className="p-3 text-right">Jobs Tracked</th>
                <th className="p-3 text-right">Total Billed</th>
                <th className="p-3 text-right">Outstanding</th>
                <th className="p-3 text-right">Retainer</th>
                <th className="p-3 text-right">Callbacks</th>
              </tr>
            </thead>
            <tbody>
              {builders.map((builder) => (
                <tr
                  key={builder.customerId}
                  className="border-b transition-colors hover:bg-muted/20"
                >
                  <td className="p-3">
                    <Link
                      href={ROUTE_BUILDERS.CUSTOMER_DETAIL(builder.customerId)}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {builder.customerName}
                    </Link>
                  </td>
                  <td className="p-3 text-right tabular-nums">{builder.entryCount}</td>
                  <td className="p-3 text-right tabular-nums">{formatCents(builder.totalBilledCents)}</td>
                  <td className="p-3 text-right tabular-nums text-amber-400">
                    {formatCents(builder.totalOutstandingCents)}
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatCents(builder.totalRetainerCents)}</td>
                  <td className="p-3 text-right tabular-nums">{builder.callbackCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
