"use client";

import { type FormEvent, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AdminFieldWrapper,
  AdminFormError,
  AdminFormActions,
} from "@/features/admin/components/form";
import type { AppRole } from "@/services/authorization";
import type { OrgUser } from "../types";
import { OPERATIONAL_ROLES, ROLE_LABELS } from "../utils/permissionsMatrix";

interface EditUserDialogProps {
  user: OrgUser;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditUserDialog({ user, onClose, onUpdated }: EditUserDialogProps) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [role, setRole] = useState<AppRole>(user.role);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          role,
        }),
      });

      if (res.ok) {
        onUpdated();
        return;
      }

      const body = await res.json().catch(() => ({}));
      setFormError(
        (body as { error?: string }).error ?? "Failed to update user. Please try again."
      );
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-atlas-2xl border border-default bg-surface p-6 shadow-atlas-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-atlas-md p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)]"
        >
          <X size={16} />
        </button>

        <h2
          id="edit-user-dialog-title"
          className="mb-1 text-base font-semibold text-primary"
        >
          Edit User
        </h2>
        <p className="mb-5 text-xs text-muted">{user.email}</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <AdminFormError error={formError} />

          <AdminFieldWrapper label="Full Name" htmlFor="edit-fullname">
            <input
              id="edit-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              maxLength={255}
              autoFocus
              className="w-full rounded-atlas-md border border-default bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </AdminFieldWrapper>

          <AdminFieldWrapper label="Role" htmlFor="edit-role" required>
            <select
              id="edit-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="w-full rounded-atlas-md border border-default bg-surface-elevated px-3 py-2 text-sm text-primary focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {OPERATIONAL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </AdminFieldWrapper>

          <AdminFormActions
            submitLabel="Save Changes"
            loadingLabel="Saving…"
            isLoading={isSubmitting}
            cancelAction={
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            }
          />
        </form>
      </div>
    </div>
  );
}
