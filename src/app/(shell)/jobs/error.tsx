"use client";

/**
 * DIAGNOSTIC — Jobs segment error boundary.
 *
 * Covers all /jobs/* routes (list, /jobs/new, /jobs/[id], /jobs/[id]/edit).
 *
 * A render throw inside the New Job form (or any job route) is caught here and
 * shown ON SCREEN so a phone user can read/screenshot the actual message and
 * digest — instead of a silent, invisible failure. The same error is also
 * reported to `/api/client-errors`, so it lands in Vercel runtime logs as a
 * `[CLIENT_ERROR]` line.
 *
 * Additive and safe: this only renders when React has already thrown; it
 * changes no normal app behavior.
 */

import { useEffect } from "react";

import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/components/observability/ClientErrorReporter";
import { ROUTES } from "@/lib/routes";

export default function JobsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort report; reportClientError never throws.
    reportClientError({
      message: error?.message ? `Jobs route render error: ${error.message}` : "Jobs route render error",
      stack: error?.stack ?? null,
      source: error?.digest ? `digest:${error.digest}` : "jobs/error.tsx",
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <SurfaceCard className="mx-auto w-full max-w-2xl">
        <div className="space-y-4 p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Jobs — Error
          </p>
          <h1 className="text-xl font-semibold text-white">
            This screen hit an error
          </h1>
          <p className="text-sm text-slate-400">
            The details below have also been sent to our logs. If you can,
            screenshot this and send it over.
          </p>

          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Message
              </p>
              <p className="mt-1 break-words font-mono text-sm text-slate-200">
                {error?.message || "Unknown error"}
              </p>
            </div>
            {error?.digest && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Digest
                </p>
                <p className="mt-1 break-words font-mono text-sm text-slate-200">
                  {error.digest}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
            <Link href={ROUTES.JOBS}>
              <Button>Back to Jobs</Button>
            </Link>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
