"use client";

/**
 * RolesScreen — view roles and permission mappings.
 *
 * Displays the existing role permission matrix from authorization.ts.
 * Provides per-role permission breakdown and role assignment entry point.
 *
 * Editing permissions within existing auth model constraints only.
 * Role assignment is delegated to the Users screen.
 */

import { useState } from "react";
import { Shield, Check, X as XIcon } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { SectionCard } from "@/components/atlas/SectionCard";
import type { AppRole } from "@/services/authorization";

import {
  OPERATIONAL_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  DISPLAY_TABLES,
  TABLE_LABELS,
  ALL_ACTIONS,
  ACTION_LABELS,
  getPermissionRowsForRole,
} from "../utils/permissionsMatrix";

// ─── Role tab ─────────────────────────────────────────────────────────────────

function RoleTab({
  role,
  isSelected,
  onClick,
}: {
  role: AppRole;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        isSelected
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
      ].join(" ")}
    >
      {ROLE_LABELS[role]}
    </button>
  );
}

// ─── Permission badge ─────────────────────────────────────────────────────────

function PermCell({ allowed }: { allowed: boolean }) {
  if (allowed) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
        <Check size={11} className="text-emerald-400" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700/40">
      <XIcon size={10} className="text-slate-600" />
    </span>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function RolesScreen() {
  const [selectedRole, setSelectedRole] = useState<AppRole>("owner");

  const rows = getPermissionRowsForRole(selectedRole);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="View the permission matrix for each role. Role assignments are managed from the Users section."
      />

      {/* Role overview cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OPERATIONAL_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setSelectedRole(role)}
            className={[
              "group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:border-blue-500/30 hover:bg-blue-500/5",
              selectedRole === role
                ? "border-blue-500/30 bg-blue-500/5 ring-1 ring-blue-500/20"
                : "border-slate-800 bg-slate-900/50",
            ].join(" ")}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  selectedRole === role
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-slate-800 text-slate-400 group-hover:bg-blue-500/10 group-hover:text-blue-400",
                ].join(" ")}
              >
                <Shield size={14} />
              </div>
              <span className="text-sm font-semibold text-slate-200">
                {ROLE_LABELS[role]}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </button>
        ))}
      </div>

      {/* Permission detail table */}
      <SectionCard
        title={`${ROLE_LABELS[selectedRole]} Permissions`}
        description={`Detailed access rights for the ${ROLE_LABELS[selectedRole].toLowerCase()} role.`}
      >
        {/* Role tabs for quick switching within the detail card */}
        <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
          {OPERATIONAL_ROLES.map((role) => (
            <RoleTab
              key={role}
              role={role}
              isSelected={selectedRole === role}
              onClick={() => setSelectedRole(role)}
            />
          ))}
        </div>

        {/* Permission matrix */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="w-[46%] py-2 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Resource
                </th>
                {ALL_ACTIONS.map((action) => (
                  <th
                    key={action}
                    className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500"
                  >
                    {ACTION_LABELS[action]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ table, tableLabel, permissions }) => (
                <tr key={table} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-2.5 text-[13px] font-medium text-slate-300">
                    {TABLE_LABELS[table] ?? tableLabel}
                  </td>
                  {ALL_ACTIONS.map((action) => (
                    <td key={action} className="py-2.5 text-center">
                      <PermCell allowed={permissions[action]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-slate-600">
          Row-scope restrictions (e.g. technicians see only their assigned jobs) are
          enforced at the database layer via RLS and are not reflected here.
        </p>
      </SectionCard>
    </div>
  );
}
