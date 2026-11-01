"use client";

/**
 * FeedbackButton — Sprint 7 Mini-Epic
 *
 * Floating action button that opens the FeedbackModal.
 * Accepts optional context IDs that are pre-populated in the form.
 */

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { FeedbackModal } from "./FeedbackModal";

interface FeedbackButtonProps {
  contextJobId?: string;
  contextCustomerId?: string;
  contextPropertyId?: string;
  /**
   * When set, the parent owns the dialog. The button only asks to open it,
   * so the phone menu and the corner button can share one dialog that is
   * not trapped inside the slide-out drawer.
   */
  onOpen?: () => void;
}

export function FeedbackButton({
  contextJobId,
  contextCustomerId,
  contextPropertyId,
  onOpen,
}: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (onOpen) {
            onOpen();
            return;
          }
          setIsOpen(true);
        }}
        aria-label="Report feedback"
        title="Report Feedback"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-slate-300 shadow-lg transition-all hover:border-white/20 hover:bg-slate-700 hover:text-white hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <MessageSquarePlus size={20} />
      </button>

      {!onOpen && isOpen ? (
        <FeedbackModal
          contextJobId={contextJobId}
          contextCustomerId={contextCustomerId}
          contextPropertyId={contextPropertyId}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
