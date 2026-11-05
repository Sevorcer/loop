"use client";

/**
 * RolesScreen — editable roles and permission matrix.
 *
 * Phase 2: owners can toggle permission overrides for roles and individual
 * users. The code matrix from authorization.ts provides defaults; DB-backed
 * overrides are layered on top.
 *
 * Invariants enforced in the UI:
 *   - Owner column is fully locked (always all permissions)
 *   - Append-only / empty-set actions cannot be granted
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Shield,
  Check,
  X as XIcon,
  Loader2,
  ArrowUpDown,
  User,
} from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { SectionCard } from "@/components/atlas/SectionCard";
import { FinancialVisibilityCard } from "../components/FinancialVisibilityCard";
import {
  getCodeMatrixPermission,
  isLockedDeny,
  type AppRole,
  type CoreTable,
  type TableAction,
} from "@/services/authorization";

import {
  OPERATIONAL_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ALL_ACTIONS,
  ACTION_LABELS,
  DISPLAY_TABLES,
  TABLE_LABELS,
} from "../utils/permissionsMatrix";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleOverrideRecord {
  role: string;
  table_name: string;
  action: string;
  allowed: boolean;
}

interface UserOverrideRecord {
  user_id: string;
  table_name: string;
  action: string;
  allowed: boolean;
}

interface OrgUserRecord {
  id: string;
  full_name: string;
  email: string;
  app_role: string;
}

// ---------------------------------------------------------------------------
// Table groupings for visual organization
// ---------------------------------------------------------------------------

const TABLE_GROUPS: { label: string; tables: CoreTable[] }[] = [
  {
    label: "Customers & Properties",
    tables: ["customers", "customer_contacts", "properties"],
  },
  {
    label: "Jobs",
    tables: [
      "jobs",
      "job_activity",
      "job_notes",
      "job_signatures",
      "job_callbacks",
      "job_financials",
      "job_financials_history",
      "job_bids",
    ],
  },
  {
    label: "Scheduling",
    tables: ["time_off", "calendar_tasks", "calendar_saved_groups"],
  },
  {
    label: "GC & Contractors",
    tables: ["contractors", "gc_ledger_entries", "gc_change_orders"],
  },
  {
    label: "Systems & Knowledge",
    tables: ["installed_systems", "knowledge_items"],
  },
  {
    label: "Admin",
    tables: ["user_profiles", "organizations", "feedback_reports"],
  },
];

// ---------------------------------------------------------------------------
// Editable permission cell
// ---------------------------------------------------------------------------

function PermCell({
  allowed,
  isDefault,
  isLocked,
  isOverridden,
  isSaving,
  onToggle,
}: {
  allowed: boolean;
  isDefault: boolean;
  isLocked: boolean;
  isOverridden: boolean;
  isSaving: boolean;
  onToggle: () => void;
}) {
  if (isSaving) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center">
        <Loader2 size={12} className="animate-spin text-slate-500" />
      </span>
    );
  }

  if (isLocked) {
    if (allowed) {
      return (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15"
          title="System invariant — cannot be changed"
        >
          <Check size={12} className="text-emerald-400" />
        </span>
      );
    }
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-700/40"
        title="System invariant — cannot be changed"
      >
        <XIcon size={10} className="text-slate-600" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "inline-flex h-6 w-6 items-center justify-center rounded-full transition-all",
        "hover:ring-2 hover:ring-blue-500/30",
        allowed ? "bg-emerald-500/15" : "bg-slate-700/40",
        isOverridden ? "ring-1 ring-amber-400/50" : "",
      ].join(" ")}
      title={
        isOverridden
          ? `Override: ${allowed ? "granted" : "denied"} (default: ${isDefault ? "granted" : "denied"})`
          : `Default: ${allowed ? "granted" : "denied"}`
      }
    >
      {allowed ? (
        <Check size={12} className="text-emerald-400" />
      ) : (
        <XIcon size={10} className="text-slate-600" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function RolesScreen() {
  const [roleOverrides, setRoleOverrides] = useState<RoleOverrideRecord[]>([]);
  const [userOverrides, setUserOverrides] = useState<UserOverrideRecord[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [viewMode, setViewMode] = useState<"roles" | "users">("roles");

  // Fetch overrides and users on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [roleRes, userRes, usersRes] = await Promise.all([
          fetch("/api/settings/permissions"),
          fetch("/api/settings/permissions/users"),
          fetch("/api/settings/users"),
        ]);

        if (roleRes.ok) {
          const data = (await roleRes.json()) as { overrides?: RoleOverrideRecord[] };
          if (!cancelled) {
            setRoleOverrides(data.overrides ?? []);
            setIsOwner(true);
          }
        }

        if (userRes.ok) {
          const data = (await userRes.json()) as { overrides?: UserOverrideRecord[] };
          if (!cancelled) setUserOverrides(data.overrides ?? []);
        }

        if (usersRes.ok) {
          const data = (await usersRes.json()) as { users?: OrgUserRecord[] };
          if (!cancelled) setOrgUsers(data.users ?? []);
        }
      } catch {
        // Non-owners will get 403 — that is expected, they see read-only view
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Override helpers
  // ---------------------------------------------------------------------------

  const roleOverrideMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const o of roleOverrides) {
      map.set(`${o.role}:${o.table_name}:${o.action}`, o.allowed);
    }
    return map;
  }, [roleOverrides]);

  const userOverrideMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const o of userOverrides) {
      map.set(`${o.user_id}:${o.table_name}:${o.action}`, o.allowed);
    }
    return map;
  }, [userOverrides]);

  const getEffectiveRolePermission = useCallback(
    (role: AppRole, table: CoreTable, action: TableAction) => {
      const defaultValue = getCodeMatrixPermission(role, table, action);
      const key = `${role}:${table}:${action}`;
      const override = roleOverrideMap.get(key);
      if (override !== undefined)
        return { allowed: override, isOverridden: true, isDefault: defaultValue };
      return { allowed: defaultValue, isOverridden: false, isDefault: defaultValue };
    },
    [roleOverrideMap],
  );

  const getEffectiveUserPermission = useCallback(
    (userId: string, role: AppRole, table: CoreTable, action: TableAction) => {
      const defaultValue = getCodeMatrixPermission(role, table, action);
      const userKey = `${userId}:${table}:${action}`;
      const userOverride = userOverrideMap.get(userKey);
      if (userOverride !== undefined) {
        return { allowed: userOverride, isOverridden: true, isDefault: defaultValue };
      }
      const roleKey = `${role}:${table}:${action}`;
      const roleOv = roleOverrideMap.get(roleKey);
      if (roleOv !== undefined) {
        return { allowed: roleOv, isOverridden: false, isDefault: defaultValue };
      }
      return { allowed: defaultValue, isOverridden: false, isDefault: defaultValue };
    },
    [roleOverrideMap, userOverrideMap],
  );

  // ---------------------------------------------------------------------------
  // Toggle handlers
  // ---------------------------------------------------------------------------

  const toggleRoleOverride = useCallback(
    async (role: AppRole, table: CoreTable, action: TableAction) => {
      const cellKey = `role:${role}:${table}:${action}`;
      setSavingCells((prev) => new Set(prev).add(cellKey));

      const { isOverridden, allowed } = getEffectiveRolePermission(role, table, action);

      try {
        if (isOverridden) {
          // Remove the override (revert to default)
          await fetch("/api/settings/permissions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role, tableName: table, action }),
          });
          setRoleOverrides((prev) =>
            prev.filter(
              (o) => !(o.role === role && o.table_name === table && o.action === action),
            ),
          );
        } else {
          // Create an override that flips the default
          const newAllowed = !allowed;
          const res = await fetch("/api/settings/permissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role, tableName: table, action, allowed: newAllowed }),
          });
          if (res.ok) {
            setRoleOverrides((prev) => [
              ...prev.filter(
                (o) => !(o.role === role && o.table_name === table && o.action === action),
              ),
              { role, table_name: table, action, allowed: newAllowed },
            ]);
          }
        }
      } catch {
        // Silently handle — cell will revert
      } finally {
        setSavingCells((prev) => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
      }
    },
    [getEffectiveRolePermission],
  );

  const toggleUserOverride = useCallback(
    async (userId: string, table: CoreTable, action: TableAction) => {
      const cellKey = `user:${userId}:${table}:${action}`;
      setSavingCells((prev) => new Set(prev).add(cellKey));

      const user = orgUsers.find((u) => u.id === userId);
      const role = (user?.app_role ?? "tech") as AppRole;
      const { allowed, isOverridden } = getEffectiveUserPermission(
        userId,
        role,
        table,
        action,
      );

      try {
        if (isOverridden) {
          await fetch("/api/settings/permissions/users", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, tableName: table, action }),
          });
          setUserOverrides((prev) =>
            prev.filter(
              (o) =>
                !(o.user_id === userId && o.table_name === table && o.action === action),
            ),
          );
        } else {
          const newAllowed = !allowed;
          const res = await fetch("/api/settings/permissions/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, tableName: table, action, allowed: newAllowed }),
          });
          if (res.ok) {
            setUserOverrides((prev) => [
              ...prev.filter(
                (o) =>
                  !(
                    o.user_id === userId &&
                    o.table_name === table &&
                    o.action === action
                  ),
              ),
              { user_id: userId, table_name: table, action, allowed: newAllowed },
            ]);
          }
        }
      } catch {
        // Silently handle
      } finally {
        setSavingCells((prev) => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
      }
    },
    [getEffectiveUserPermission, orgUsers],
  );

  // ---------------------------------------------------------------------------
  // Selected user details
  // ---------------------------------------------------------------------------

  const selectedUser = orgUsers.find((u) => u.id === selectedUserId);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description={
          isOwner
            ? "Edit the permission matrix for each role, or set per-user overrides."
            : "View the permission matrix for each role. Role assignments are managed from the Users section."
        }
      />

      {/* Owner-only financial visibility setting */}
      <FinancialVisibilityCard />

      {/* Role overview cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OPERATIONAL_ROLES.map((role) => (
          <div
            key={role}
            className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                <Shield size={14} />
              </div>
              <span className="text-sm font-semibold text-slate-200">
                {ROLE_LABELS[role]}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>
        ))}
      </div>

      {/* View mode tabs */}
      {isOwner && (
        <div className="flex gap-1 rounded-lg bg-slate-900/50 p-1 w-fit">
          <button
            type="button"
            onClick={() => setViewMode("roles")}
            className={[
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "roles"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            ].join(" ")}
          >
            <ArrowUpDown size={12} />
            Role Permissions
          </button>
          <button
            type="button"
            onClick={() => setViewMode("users")}
            className={[
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "users"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            ].join(" ")}
          >
            <User size={12} />
            User Overrides
          </button>
        </div>
      )}

      {/* Role permissions grid */}
      {viewMode === "roles" && (
        <SectionCard
          title="Role Permission Matrix"
          description={
            isOwner
              ? "Click a cell to toggle. Amber ring indicates an override. Owner permissions are locked."
              : "Permission defaults for each operational role."
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="sticky left-0 z-10 min-w-[140px] bg-card py-2 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Resource
                  </th>
                  {OPERATIONAL_ROLES.map((role) => (
                    <th
                      key={role}
                      colSpan={4}
                      className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-slate-800/50">
                  <th className="sticky left-0 z-10 bg-card" />
                  {OPERATIONAL_ROLES.map((role) =>
                    ALL_ACTIONS.map((action) => (
                      <th
                        key={`${role}-${action}`}
                        className="py-1 text-center text-[9px] font-medium uppercase tracking-wider text-slate-600"
                      >
                        {ACTION_LABELS[action][0]}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {TABLE_GROUPS.map((group) => [
                  <tr key={`group-${group.label}`}>
                    <td
                      colSpan={1 + OPERATIONAL_ROLES.length * 4}
                      className="pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600"
                    >
                      {group.label}
                    </td>
                  </tr>,
                  ...group.tables.map((table) => (
                    <tr
                      key={table}
                      className="border-b border-slate-800/30 last:border-0"
                    >
                      <td className="sticky left-0 z-10 bg-card py-2 text-[12px] font-medium text-slate-300">
                        {TABLE_LABELS[table]}
                      </td>
                      {OPERATIONAL_ROLES.map((role) =>
                        ALL_ACTIONS.map((action) => {
                          const isOwnerRole = role === "owner";
                          const locked = isOwnerRole || isLockedDeny(table, action);
                          const { allowed, isOverridden, isDefault } =
                            getEffectiveRolePermission(role, table, action);
                          const cellKey = `role:${role}:${table}:${action}`;
                          const isSaving = savingCells.has(cellKey);

                          return (
                            <td
                              key={`${role}-${action}`}
                              className="py-2 text-center"
                            >
                              <PermCell
                                allowed={allowed}
                                isDefault={isDefault}
                                isLocked={locked || !isOwner}
                                isOverridden={isOverridden}
                                isSaving={isSaving}
                                onToggle={() =>
                                  toggleRoleOverride(role, table, action)
                                }
                              />
                            </td>
                          );
                        }),
                      )}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500/15">
                <Check size={8} className="text-emerald-400" />
              </span>
              Allowed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-slate-700/40" />
              Denied
            </span>
            {isOwner && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-slate-700/40 ring-1 ring-amber-400/50" />
                Override active
              </span>
            )}
          </div>

          <p className="mt-2 text-[11px] text-slate-600">
            R = Read, C = Create, U = Update, D = Delete. Row-scope restrictions
            (e.g. technicians see only assigned jobs) are enforced via RLS and
            not reflected here.
          </p>
        </SectionCard>
      )}

      {/* User overrides section */}
      {viewMode === "users" && isOwner && (
        <SectionCard
          title="User Permission Overrides"
          description="Grant or deny permissions for individual users above their role defaults."
        >
          {/* User selector */}
          <div className="mb-5">
            <label
              htmlFor="user-select"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Select user
            </label>
            <select
              id="user-select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Choose a user...</option>
              {orgUsers
                .filter((u) => u.app_role !== "owner")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} (
                    {ROLE_LABELS[u.app_role as AppRole] ?? u.app_role})
                  </option>
                ))}
            </select>
          </div>

          {selectedUser && (
            <div>
              <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="text-sm font-medium text-slate-200">
                  {selectedUser.full_name || selectedUser.email}
                </div>
                <div className="text-xs text-slate-500">
                  Role:{" "}
                  {ROLE_LABELS[selectedUser.app_role as AppRole] ??
                    selectedUser.app_role}
                  {selectedUser.email && ` · ${selectedUser.email}`}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="min-w-[140px] py-2 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
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
                    {TABLE_GROUPS.map((group) => [
                      <tr key={`ugroup-${group.label}`}>
                        <td
                          colSpan={5}
                          className="pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600"
                        >
                          {group.label}
                        </td>
                      </tr>,
                      ...group.tables.map((table) => (
                        <tr
                          key={table}
                          className="border-b border-slate-800/30 last:border-0"
                        >
                          <td className="py-2 text-[12px] font-medium text-slate-300">
                            {TABLE_LABELS[table]}
                          </td>
                          {ALL_ACTIONS.map((action) => {
                            const role = selectedUser.app_role as AppRole;
                            const locked =
                              role === "owner" || isLockedDeny(table, action);
                            const { allowed, isOverridden, isDefault } =
                              getEffectiveUserPermission(
                                selectedUser.id,
                                role,
                                table,
                                action,
                              );
                            const cellKey = `user:${selectedUser.id}:${table}:${action}`;
                            const isSaving = savingCells.has(cellKey);

                            return (
                              <td key={action} className="py-2 text-center">
                                <PermCell
                                  allowed={allowed}
                                  isDefault={isDefault}
                                  isLocked={locked}
                                  isOverridden={isOverridden}
                                  isSaving={isSaving}
                                  onToggle={() =>
                                    toggleUserOverride(
                                      selectedUser.id,
                                      table,
                                      action,
                                    )
                                  }
                                />
                              </td>
                            );
                          })}
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-[11px] text-slate-600">
                User overrides take priority over role defaults. An amber ring
                indicates a user-level override. Click to toggle; click again to
                revert to role default.
              </p>
            </div>
          )}

          {!selectedUser && (
            <p className="py-8 text-center text-sm text-slate-500">
              Select a user above to view and edit their individual permission
              overrides.
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
}
