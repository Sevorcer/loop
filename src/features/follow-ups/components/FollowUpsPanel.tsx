"use client";

import { useCallback, useEffect, useState } from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { FollowUpItem } from "../types/followUp";
import { FollowUpRow } from "./FollowUpRow";
import { FollowUpUnmarkButton } from "./FollowUpUnmarkButton";

/** The Follow-ups worklist shown on the Jobs board when the chip is on. */
export function FollowUpsPanel({ onCount }: { onCount?: (count: number) => void }) {
  const { role } = useCurrentRole();
  const [items, setItems] = useState<FollowUpItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!role) return;
    try {
      const response = await requestJson<{ items: FollowUpItem[] }>("/api/follow-ups", {
        role,
        cache: "no-store",
      });
      setItems(response.items);
      onCount?.(response.items.length);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load follow-ups.");
    }
  }, [role, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !items) return <p className="px-4 py-6 text-sm text-red-300 md:px-6">{error}</p>;
  if (!items) return <p className="px-4 py-6 text-sm text-slate-400 md:px-6">Loading follow-ups...</p>;
  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-400 md:px-6">No open follow-ups. Mark a job from its detail page.</p>;
  }

  return (
    <ul className="max-h-[620px] divide-y divide-white/10 overflow-y-auto">
      {items.map((item) => (
        <FollowUpRow
          key={item.jobId}
          item={item}
          action={
            <FollowUpUnmarkButton
              jobId={item.jobId}
              onCleared={(jobId) => {
                setItems((current) => {
                  const next = (current ?? []).filter((entry) => entry.jobId !== jobId);
                  onCount?.(next.length);
                  return next;
                });
              }}
            />
          }
        />
      ))}
    </ul>
  );
}
