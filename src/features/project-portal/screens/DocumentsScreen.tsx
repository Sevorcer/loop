"use client";

import { Download, FileText, MessageCircle } from "lucide-react";

import { StaleBanner } from "../components/StaleBanner";
import { usePortal } from "../state/PortalProvider";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DOC_TYPE_LABELS: Record<string, string> = {
  proposal: "Proposal",
  signed_agreement: "Signed Agreement",
  inspection_report: "Inspection Report",
  warranty: "Warranty",
  manual: "Manual",
  maintenance_recommendation: "Maintenance Recommendation",
  photo: "Photo",
};

/**
 * Documents screen — Sprint 22A MVP.
 *
 * Displays customer-facing documents only (visibility: "customer").
 * Internal documents are filtered at the projection layer — never reach this screen.
 *
 * Empty state (ES-08) is rendered when no documents have been published yet.
 */
export function DocumentsScreen() {
  const { projection, permissionSet } = usePortal();
  const { documents: docsVM, freshness } = projection;

  if (!permissionSet?.canViewDocuments) return null;

  const docs = docsVM?.documents ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <StaleBanner freshness={freshness} />

      {docs.length === 0 ? (
        // ES-08 — Empty Documents
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          aria-label="No documents available"
        >
          <div
            aria-hidden="true"
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground"
          >
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No documents available yet.
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Documents shared by your contractor will appear here.
          </p>
          <a
            href="#contact"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            Contact Team
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">
              Project Documents
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {docs.length} document{docs.length !== 1 ? "s" : ""} available
            </p>
          </div>

          <ul className="divide-y divide-border" aria-label="Project documents">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated text-muted-foreground"
                  >
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {doc.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType} ·{" "}
                      {formatFileSize(doc.fileSizeBytes)} · {formatDate(doc.publishedAt)}
                    </p>
                  </div>
                </div>

                {permissionSet?.canDownloadDocuments ? (
                  <button
                    type="button"
                    aria-label={`Download ${doc.name}`}
                    className="ml-2 shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    onClick={() => {
                      // Mock download — no live backend in Sprint 22A
                      alert(`Download: ${doc.name} (mock — no file in Sprint 22A)`);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
