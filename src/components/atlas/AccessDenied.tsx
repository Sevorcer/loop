import { ShieldOff } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

interface AccessDeniedProps {
  title?: string;
  description?: string;
  /** When true, shows a "Back to Dashboard" link button. Defaults to true. */
  showHomeLink?: boolean;
}

/**
 * AccessDenied — Atlas-tier access denied / unauthorized state.
 *
 * Used for:
 * - Full-page route blocks (e.g. /jobs/new when role lacks jobs.insert)
 * - Inline section blocks inside a detail view
 *
 * Accessibility: uses role="alert" so screen readers announce the denial.
 */
export function AccessDenied({
  title = "Access Denied",
  description = "You don't have permission to access this area. Contact your administrator if you believe this is an error.",
  showHomeLink = true,
}: AccessDeniedProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500/15 to-slate-500/10 ring-1 ring-white/10">
        <ShieldOff className="h-7 w-7 text-red-400" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="max-w-md text-sm leading-6 text-slate-400">{description}</p>
      </div>

      {showHomeLink ? (
        <Link href={ROUTES.DASHBOARD}>
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      ) : null}
    </div>
  );
}
