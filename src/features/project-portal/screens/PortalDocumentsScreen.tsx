"use client";

import { FileText, Download } from "lucide-react";

import { usePortal } from "../state/PortalProvider";
import { PortalEmptyState } from "../components/PortalErrorState";
import type { DocumentType, PortalDocument } from "../types/portalTypes";

// ─── Document Type Labels ─────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  proposal: "Proposal",
  signed_agreement: "Signed Agreement",
  manual: "Manual",
  warranty: "Warranty",
  inspection_report: "Inspection Report",
  maintenance_recommendation: "Maintenance Recommendation",
  other: "Document",
};

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc }: { doc: PortalDocument }) {
  const publishedDate = new Date(doc.publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const sizeKB = Math.round(doc.fileSizeBytes / 1024);
  const typeLabel = DOC_TYPE_LABELS[doc.documentType];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:bg-slate-800/50">
      {/* Icon */}
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400"
      >
        <FileText size={18} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-white">{doc.name}</p>
        <p className="text-xs text-slate-500">
          {typeLabel} · {publishedDate} · {sizeKB} KB
        </p>
      </div>

      {/* Download CTA */}
      <button
        type="button"
        aria-label={`Download ${doc.name}`}
        className="flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        onClick={() => {
          // In production this would trigger a signed URL download
          // Audit log event: document.viewed
        }}
      >
        <Download size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PortalDocumentsScreen() {
  const { documents, permissions } = usePortal();

  if (!permissions?.canViewDocuments) {
    return (
      <PortalEmptyState
        heading="Documents not available."
        body="Your account doesn't have access to project documents."
      />
    );
  }

  if (documents.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-white">Documents</h1>
        <PortalEmptyState
          heading="No documents available yet."
          body="Documents shared by your contractor will appear here."
          ctaLabel="Contact Team"
          ctaHref="contact"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Documents</h1>
        <p className="mt-1 text-sm text-slate-400">
          {documents.length} {documents.length === 1 ? "document" : "documents"} available
        </p>
      </div>

      <section aria-label="Project documents">
        <div className="space-y-2" role="list" aria-label="Document list">
          {documents.map((doc) => (
            <div key={doc.id} role="listitem">
              <DocumentRow doc={doc} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
