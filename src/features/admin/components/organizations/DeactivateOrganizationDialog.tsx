"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface OrganizationForDeactivate {
  id: string;
  name: string;
}

interface DeactivateOrganizationDialogProps {
  organization: OrganizationForDeactivate;
  onClose: () => void;
  onDeactivated: () => void;
}

export function DeactivateOrganizationDialog({
  organization,
  onClose,
  onDeactivated,
}: DeactivateOrganizationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeactivate() {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDeactivated();
        return;
      }

      const body = await res.json().catch(() => ({}));

      if (res.status === 404) {
        setError("This organization no longer exists. It may have already been deactivated.");
      } else if (res.status === 403) {
        setError("You do not have permission to deactivate organizations.");
      } else {
        setError(body.message ?? "Failed to deactivate organization. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-org-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isSubmitting ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
          <AlertTriangle size={20} />
        </div>

        <h2
          id="deactivate-org-dialog-title"
          className="text-base font-semibold text-slate-100"
        >
          Deactivate organization?
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          <span className="font-medium text-slate-200">{organization.name}</span> will be
          deactivated. This is reversible — contact a platform administrator to restore it.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDeactivate}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full bg-red-600 text-white hover:bg-red-500 sm:w-auto"
          >
            {isSubmitting ? "Deactivating…" : "Deactivate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

