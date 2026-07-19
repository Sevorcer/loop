"use client";

import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <SurfaceCard className="mx-auto w-full max-w-2xl">
        <div className="space-y-4 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Error
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-400">
            An unexpected error occurred. You can try refreshing the page or
            return to the dashboard.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-slate-600">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
            <Link href={ROUTES.DASHBOARD}>
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
