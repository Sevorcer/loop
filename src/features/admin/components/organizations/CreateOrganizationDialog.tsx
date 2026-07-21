"use client";

import { type FormEvent, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AdminFieldWrapper,
  AdminFieldError,
  AdminFormError,
  AdminFormActions,
} from "@/features/admin/components/form";

interface CreateOrganizationDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateOrganizationDialog({
  onClose,
  onCreated,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("");
  const [nameErrors, setNameErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNameErrors([]);
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        onCreated();
        return;
      }

      const body = await res.json().catch(() => ({}));

      if (res.status === 400 && body.fieldErrors?.name) {
        setNameErrors(body.fieldErrors.name as string[]);
      } else {
        setFormError(body.message ?? "Failed to create organization. Please try again.");
      }
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
      aria-labelledby="create-org-dialog-title"
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
          id="create-org-dialog-title"
          className="mb-5 text-base font-semibold text-primary"
        >
          New Organization
        </h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <AdminFormError error={formError} />

          <AdminFieldWrapper label="Name" htmlFor="create-org-name" required>
            <input
              id="create-org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme HVAC"
              maxLength={255}
              autoFocus
              aria-describedby={nameErrors.length ? "create-org-name-error" : undefined}
              aria-invalid={nameErrors.length > 0}
              className="w-full rounded-atlas-md border border-default bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <AdminFieldError fieldId="create-org-name" errors={nameErrors} />
          </AdminFieldWrapper>

          <AdminFormActions
            submitLabel="Create Organization"
            loadingLabel="Creating…"
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
