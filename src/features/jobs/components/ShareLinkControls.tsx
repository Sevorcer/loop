"use client";

/**
 * ShareLinkControls — GC Portal Task 1
 *
 * Provides UI for creating, copying, and revoking share links on a job page.
 * Only visible to office+ roles.
 */

import { useState, useCallback, useEffect } from "react";
import { Link2, Copy, Trash2, Loader2, Check } from "lucide-react";

interface ShareLinkControlsProps {
  jobId: string;
  /** Optional — when omitted, the component fetches its own initial state. */
  hasActiveLink?: boolean;
  onLinkCreated?: (token: string) => void;
  onLinkRevoked?: () => void;
}

export function ShareLinkControls({
  jobId,
  hasActiveLink,
  onLinkCreated,
  onLinkRevoked,
}: ShareLinkControlsProps) {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(hasActiveLink ?? false);
  const [ready, setReady] = useState(hasActiveLink !== undefined);

  /* Self-contained fetch when no initial value is provided */
  useEffect(() => {
    if (hasActiveLink !== undefined) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${jobId}/share-link`);
        if (!res.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setActive(Boolean(data.shareLink));
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [jobId, hasActiveLink]);

  const createLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/share-link`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      const newToken = data.token as string;
      setToken(newToken);
      setActive(true);
      onLinkCreated?.(newToken);
    } catch {
      // Error handling is minimal for v1
    } finally {
      setLoading(false);
    }
  }, [jobId, onLinkCreated]);

  const revokeLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/share-link`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke share link");
      setToken(null);
      setActive(false);
      onLinkRevoked?.();
    } catch {
      // Error handling is minimal for v1
    } finally {
      setLoading(false);
    }
  }, [jobId, onLinkRevoked]);

  const copyLink = useCallback(async () => {
    if (!token) return;
    const url = `${window.location.origin}/gc-portal/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token]);

  if (!ready) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Builder Portal Link
        </span>
      </div>

      {token && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <code className="flex-1 truncate text-xs text-muted-foreground">
            {`${typeof window !== "undefined" ? window.location.origin : ""}/gc-portal/${token}`}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            aria-label="Copy link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {!active ? (
          <button
            type="button"
            onClick={createLink}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Create Share Link
          </button>
        ) : (
          <>
            {!token && (
              <button
                type="button"
                onClick={createLink}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Regenerate Link
              </button>
            )}
            <button
              type="button"
              onClick={revokeLink}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Revoke Link
            </button>
          </>
        )}
      </div>

      {!active && (
        <p className="text-xs text-muted-foreground">
          Create a link to share this job&apos;s progress with the builder.
        </p>
      )}
      {active && !token && (
        <p className="text-xs text-muted-foreground">
          An active share link exists. Regenerate to get a new link URL.
        </p>
      )}
      {token && (
        <p className="text-xs text-amber-400">
          Copy this link now — the token will not be shown again.
        </p>
      )}
    </div>
  );
}
