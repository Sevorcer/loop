"use client";

/**
 * PortalPhotosToggle — GC Portal v2
 *
 * Toggle control for portal_photos_visible flag on a job.
 * Placed near the share-link controls on the job page.
 * Only visible to office+ roles.
 *
 * Pattern mirrors PortalMoneyToggle.
 */

import { useState, useCallback, useEffect } from "react";
import { Camera, Loader2 } from "lucide-react";

interface PortalPhotosToggleProps {
  jobId: string;
  /** Optional — when omitted, the component fetches its own initial state. */
  initialVisible?: boolean;
  onToggle?: (visible: boolean) => void;
}

export function PortalPhotosToggle({
  jobId,
  initialVisible,
  onToggle,
}: PortalPhotosToggleProps) {
  const [visible, setVisible] = useState(initialVisible ?? false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(initialVisible !== undefined);

  /* Self-contained fetch when no initial value is provided */
  useEffect(() => {
    if (initialVisible !== undefined) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${jobId}/portal-photos`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setVisible(Boolean(data.portalPhotosVisible));
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [jobId, initialVisible]);

  const toggle = useCallback(async () => {
    const next = !visible;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/portal-photos`, {
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

  if (!ready) return null;

  return (
    <div className="flex items-center gap-3">
      <Camera className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <span className="text-sm font-medium text-foreground">
          Show Photos in Portal
        </span>
        <p className="text-xs text-muted-foreground">
          {visible
            ? "Builders can see customer-visible job photos."
            : "Photos are hidden from the builder portal."}
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
