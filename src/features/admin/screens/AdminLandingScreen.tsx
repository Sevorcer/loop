import Link from "next/link";
import { ShieldCheck, Clock } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { ADMIN_ROUTES } from "@/lib/routes";
import { ADMIN_MODULE_PLACEHOLDERS } from "../config/adminNavItems";

/**
 * Administration landing page — Sprint 30 IA refactor.
 *
 * Entry point for the /admin area. Communicates governance/configuration
 * intent and surfaces placeholder cards for upcoming modules.
 */
export function AdminLandingScreen() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Administration"
        description="Platform governance and configuration. Manage organizations, users, roles, integrations, and system settings."
      />

      {/* Active modules */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Available
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={ADMIN_ROUTES.ORGANIZATIONS}
            className="group flex items-start gap-4 rounded-xl border border-default bg-surface p-4 transition-colors hover-surface-elevated"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated ring-1 ring-default">
              <ShieldCheck size={17} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium transition-colors group-hover:text-primary">
                Organizations
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Manage platform organizations. Restricted to platform administrators.
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Planned modules */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Coming soon
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_MODULE_PLACEHOLDERS.map((mod) => (
            <div
              key={mod.name}
              className="flex items-start gap-4 rounded-xl border border-default bg-surface p-4 opacity-60"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated ring-1 ring-default">
                <Clock size={15} className="text-muted" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{mod.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{mod.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
