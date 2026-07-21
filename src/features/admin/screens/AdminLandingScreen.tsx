import { ShieldCheck, Clock } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
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
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Available
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="/admin/organizations"
            className="group flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-700 hover:bg-slate-800/60"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600/20 ring-1 ring-red-500/30">
              <ShieldCheck size={17} className="text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 group-hover:text-white">
                Organizations
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                Manage platform organizations. Restricted to platform administrators.
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* Planned modules */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Coming soon
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_MODULE_PLACEHOLDERS.map((mod) => (
            <div
              key={mod.name}
              className="flex items-start gap-4 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 opacity-60"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700/50">
                <Clock size={15} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-300">{mod.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{mod.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
