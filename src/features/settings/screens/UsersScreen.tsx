"use client";

/**
 * UsersScreen — team member management.
 *
 * Allows owner/manager to:
 * - View all org users with role, status, and last login
 * - Invite new users by email
 * - Edit user name and role
 * - Activate or deactivate accounts
 * - Trigger password reset emails
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { UserPlus, MoreHorizontal, Mail, Pencil, Power, PowerOff, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { SectionCard } from "@/components/atlas/SectionCard";
import { EmptyState } from "@/components/atlas/EmptyState";
import { LoadingState } from "@/components/atlas/LoadingState";
import { Button } from "@/components/ui/button";

import type { OrgUser } from "../types";
import { ROLE_LABELS } from "../utils/permissionsMatrix";
import { InviteUserDialog } from "../components/InviteUserDialog";
import { EditUserDialog } from "../components/EditUserDialog";
import { UserStatusBadge } from "../components/UserStatusBadge";

// ─── Row action menu ─────────────────────────────────────────────────────────

function ActionMenu({
  user,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onResendInvite,
}: {
  user: OrgUser;
  onEdit: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
  onResendInvite: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="User actions"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 md:min-h-0 md:min-w-0"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-8 z-20 min-w-[168px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-atlas-lg">
            <button
              type="button"
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 md:min-h-0"
            >
              <Pencil size={13} className="text-slate-500" />
              Edit
            </button>
            {user.lastSignInAt ? (
              <button
                type="button"
                onClick={() => { setOpen(false); onResetPassword(); }}
                className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 md:min-h-0"
              >
                <Mail size={13} className="text-slate-500" />
                Send Password Reset
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setOpen(false); onResendInvite(); }}
                className="flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 md:min-h-0"
              >
                <Mail size={13} className="text-slate-500" />
                Resend invite
              </button>
            )}
            <div className="my-1 border-t border-slate-800" />
            <button
              type="button"
              onClick={() => { setOpen(false); onToggleStatus(); }}
              className={[
                "flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-white/5 md:min-h-0",
                user.status === "active" ? "text-amber-400" : "text-emerald-400",
              ].join(" ")}
            >
              {user.status === "active" ? (
                <PowerOff size={13} />
              ) : (
                <Power size={13} />
              )}
              {user.status === "active" ? "Deactivate" : "Activate"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLastLogin(lastSignInAt: string | null): string {
  if (!lastSignInAt) return "Never";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(lastSignInAt));
  } catch {
    return "—";
  }
}

/**
 * The member's display name. Falls back to the email when the profile has no
 * full_name (auth-only accounts such as deactivated shared logins have a
 * profile row but no name), and only to "No name" when neither is set.
 */
function displayMemberName(user: OrgUser): ReactNode {
  const name = user.fullName?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email;
  return <span className="text-slate-500">No name</span>;
}

function getUserInitials(user: OrgUser): string {
  const name = user.fullName ?? user.email ?? "";
  return name
    .split(" ")
    .filter((p) => p.length > 0)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

const FEEDBACK_DISPLAY_DURATION_MS = 4000;

// ─── Main screen ─────────────────────────────────────────────────────────────

export function UsersScreen() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const signal =
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(12_000)
          : undefined;
      const res = await fetch("/api/settings/users", {
        cache: "no-store",
        signal,
      });
      if (!res.ok) throw new Error("Failed to load users.");
      const data = (await res.json()) as { users?: OrgUser[] };
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError("Could not load team members. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      await fetchUsers();
    };

    void loadUsers();
  }, [fetchUsers]);

  async function handleToggleStatus(user: OrgUser) {
    const next = user.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setActionFeedback(
          `${user.fullName ?? user.email} has been ${next === "active" ? "activated" : "deactivated"}.`
        );
        await fetchUsers();
        setTimeout(() => setActionFeedback(null), FEEDBACK_DISPLAY_DURATION_MS);
      }
    } catch {
      // Silently ignore — user stays unchanged
    }
  }

  async function handleResetPassword(user: OrgUser) {
    setActionError(null);
    try {
      const res = await fetch(`/api/settings/users/${user.id}/reset-password`, {
        method: "POST",
      });
      if (res.ok) {
        setActionFeedback(`Password reset email sent to ${user.email}.`);
        setTimeout(() => setActionFeedback(null), FEEDBACK_DISPLAY_DURATION_MS);
        return;
      }
      setActionError("Could not send the password reset email.");
    } catch {
      setActionError("Could not send the password reset email.");
    }
  }

  async function handleResendInvite(user: OrgUser) {
    setActionError(null);
    try {
      const res = await fetch(`/api/settings/users/${user.id}/resend-invite`, {
        method: "POST",
      });
      if (res.ok) {
        setActionFeedback(`A new invite was sent to ${user.email}.`);
        setTimeout(() => setActionFeedback(null), FEEDBACK_DISPLAY_DURATION_MS);
        return;
      }
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setActionError(body?.message || "Could not resend the invite.");
    } catch {
      setActionError("Could not resend the invite.");
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Manage team members, roles, and account access for your organization."
          actions={
            <Button
              type="button"
              onClick={() => setShowInviteDialog(true)}
              className="gap-2"
            >
              <UserPlus size={15} />
              Invite Member
            </Button>
          }
        />

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <RefreshCw size={14} />
            {actionFeedback}
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {actionError}
          </div>
        )}

        <SectionCard
          title="Team Members"
          description={
            isLoading
              ? "Loading team members…"
              : `${users.length} member${users.length !== 1 ? "s" : ""}`
          }
        >
          {isLoading ? (
            <LoadingState message="Loading team members…" />
          ) : error ? (
            <EmptyState
              title="Could not load users"
              description={error}
              action={
                <Button type="button" variant="ghost" onClick={fetchUsers}>
                  Try Again
                </Button>
              }
            />
          ) : users.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Invite your first team member to get started."
              action={
                <Button
                  type="button"
                  onClick={() => setShowInviteDialog(true)}
                  className="gap-2"
                >
                  <UserPlus size={15} />
                  Invite Member
                </Button>
              }
            />
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="min-w-0 rounded-2xl border border-slate-800 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-200">
                        {displayMemberName(user)}
                      </p>
                      <p className="break-all text-xs text-slate-500">{user.email || "—"}</p>
                    </div>
                    <ActionMenu
                      user={user}
                      onEdit={() => setEditingUser(user)}
                      onToggleStatus={() => handleToggleStatus(user)}
                      onResetPassword={() => handleResetPassword(user)}
                      onResendInvite={() => handleResendInvite(user)}
                    />
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Role</dt>
                      <dd className="text-slate-300">{ROLE_LABELS[user.role]}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Status</dt>
                      <dd><UserStatusBadge status={user.status} /></dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Last login</dt>
                      <dd className="text-slate-500">{formatLastLogin(user.lastSignInAt)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="pb-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Member
                    </th>
                    <th className="pb-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Role
                    </th>
                    <th className="pb-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Status
                    </th>
                    <th className="pb-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Last Login
                    </th>
                    <th className="pb-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-800/50 last:border-0"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/20">
                            <span className="text-[10px] font-semibold">
                              {getUserInitials(user)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-200">
                              {displayMemberName(user)}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {user.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-slate-300">
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="py-3">
                        <UserStatusBadge status={user.status} />
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-slate-500">
                          {formatLastLogin(user.lastSignInAt)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <ActionMenu
                          user={user}
                          onEdit={() => setEditingUser(user)}
                          onToggleStatus={() => handleToggleStatus(user)}
                          onResetPassword={() => handleResetPassword(user)}
                          onResendInvite={() => handleResendInvite(user)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </SectionCard>
      </div>

      {showInviteDialog && (
        <InviteUserDialog
          onClose={() => setShowInviteDialog(false)}
          onInvited={() => {
            setShowInviteDialog(false);
            void fetchUsers();
          }}
        />
      )}

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => {
            setEditingUser(null);
            void fetchUsers();
          }}
        />
      )}
    </>
  );
}
