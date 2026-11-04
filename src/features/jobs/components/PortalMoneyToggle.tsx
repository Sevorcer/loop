"use client";

/**
 * PortalMoneyToggle — GC Portal Task 3
 *
 * Toggle control for portal_money_visible flag on a job.
 * Placed near the share-link controls on the job page.
 * Only visible to office+ roles.
 */

import { useState, useCallback } from "react";
import { DollarSign, Loader2 } from "lucide-react";

interface PortalMoneyToggleProps {
  jobId: string;
  initialVisible: boolean;
  onToggle?: (visible: boolean) => void;
}

export function PortalMoneyToggle({
  jobId,
  initialVisible,
  onToggle,
}: PortalMoneyToggleProps) {
  const [visible, setVisible] = useState(initialVisible);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    const next = !visible;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/portal-money`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: next }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      setVisible(next);
      onToggle?.(next);
    } catch {
      // Revert on failure — state stays as-is
    } finally {
      setLoading(false);
    }
  }, [jobId, visible, onToggle]);

  return (
    <div className="flex items-center gap-3">
      <DollarSign className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <span className="text-sm font-medium text-foreground">
          Show Financials in Portal
        </span>
        <p className="text-xs text-muted-foreground">
          {visible
            ? "Builders can see price, invoices, and balance."
            : "Financial data is hidden from the builder portal."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        onClick={toggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
          visible ? "bg-primary" : "bg-border"
        }`}
      >
        {loading ? (
          <Loader2 className="absolute left-1 h-4 w-4 animate-spin text-foreground" />
        ) : (
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              visible ? "translate-x-5" : "translate-x-1"
            }`}
          />
        )}
      </button>
    </div>
  );
}
