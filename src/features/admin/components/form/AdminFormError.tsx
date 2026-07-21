"use client";

/**
 * AdminFormError — form-level error banner.
 *
 * Displays a non-field error (e.g. a server-side API error or network failure)
 * prominently at the top of a form. Renders nothing when `error` is falsy.
 */

import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

interface AdminFormErrorProps {
  /** The error message to display. Renders nothing when falsy. */
  error?: string | null;
  /** Optional request ID shown for support correlation. */
  requestId?: string;
  /** Additional class names for the outer element. */
  className?: string;
}

export function AdminFormError({ error, requestId, className }: AdminFormErrorProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300",
        className
      )}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{error}</p>
        {requestId ? (
          <p className="text-xs text-red-400/70">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
