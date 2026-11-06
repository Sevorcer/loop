"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DialogShellProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Minimal accessible modal: labelled, Escape to close, focus moves in on
 * open and returns on close.
 *
 * Rendered through a portal to <body>: the panel is position:fixed, and a
 * fixed element is contained by any transformed ancestor — SectionCard's
 * hover-lift transform (applied while the pointer is over the card, which
 * is the whole time a dialog launched from the card is open) trapped the
 * overlay inside the card, clipping tall dialogs (Add van) to a slice of
 * the card with their top and bottom unreachable (2026-11-06).
 */
export function DialogShell({ title, description, onClose, children }: DialogShellProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-dialog-close])");
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-atlas-2xl border border-default bg-surface p-5 shadow-atlas-lg sm:max-w-lg sm:p-6"
      >
        <button
          type="button"
          data-dialog-close
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-atlas-md p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:min-h-0 sm:min-w-0"
        >
          <X size={16} aria-hidden="true" />
        </button>
        <h2 id={titleId} className="pr-10 text-base font-semibold text-primary">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-1 text-sm text-muted">
            {description}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
