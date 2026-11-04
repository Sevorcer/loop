"use client";

import { FileText, Download } from "lucide-react";
import type { PortalDocument } from "../types/gcPortal";

interface GcPortalDocumentsProps {
  documents: PortalDocument[];
}

export function GcPortalDocuments({ documents }: GcPortalDocumentsProps) {
  return (
    <div className="flex flex-col gap-2">
      {documents.map((doc) => (
        <a
          key={doc.id}
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-elevated"
        >
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {doc.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(doc.uploadedAt)}
            </p>
          </div>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
