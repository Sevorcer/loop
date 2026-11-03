"use client";

import { useEffect } from "react";
import { Cpu, X } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import {
  InstalledSystemForm,
  type InstalledSystemFormContext,
} from "./InstalledSystemForm";
import type { InstalledSystem } from "../types/installedSystem";

interface AddSystemDialogProps {
  /** Job/property context so the created system links to this job. */
  context: InstalledSystemFormContext;
  onClose: () => void;
  onCreated: (system: InstalledSystem) => void;
}

/**
 * AddSystemDialog — in-place create flow for the job Systems tab.
 *
 * Instead of navigating away to the standalone /installed-systems/new page,
 * this mounts the existing {@link InstalledSystemForm} inside a modal so the
 * user stays on the job. It reuses the exact same create path — the form POSTs
 * to /api/installed-systems, which enforces role/RLS server-side and keeps the
 * S2 warranty rules — and passes the job context through so the new record is
 * linked to the job via `installed_systems.job_id`. On success the installed-
 * systems provider is refreshed, which surfaces the new system in the tab and
 * clears the closeout "Installed systems" gate without a page change.
 */
export function AddSystemDialog({ context, onClose, onCreated }: AddSystemDialogProps) {
  // Escape closes the dialog (mouse users get the backdrop + close button).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-system-dialog-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <SurfaceCard className="relative z-10 my-8 w-full max-w-3xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-white/10">
              <Cpu className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h2
                id="add-system-dialog-title"
                className="text-lg font-semibold text-white"
              >
                Add Installed System
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {context.jobNumber ? (
                  <>
                    Linked to job{" "}
                    <span className="font-medium text-slate-200">
                      {context.jobNumber}
                    </span>
                  </>
                ) : (
                  "This system will be linked to the current job."
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <InstalledSystemForm
            context={context}
            embedded
            onCreated={onCreated}
            onCancel={onClose}
          />
        </div>
      </SurfaceCard>
    </div>
  );
}
