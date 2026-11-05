"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";

interface FollowUpUnmarkButtonProps {
  jobId: string;
  /** Called after a successful unmark (client lists drop the row). */
  onCleared?: (jobId: string) => void;
}

/** Clears a job's follow-up flag without opening the job. */
export function FollowUpUnmarkButton({ jobId, onCleared }: FollowUpUnmarkButtonProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unmark() {
    setBusy(true);
    setError(null);
    try {
      await requestJson(`/api/jobs/${jobId}/follow-up`, {
        method: "PUT",
        role,
        body: { needed: false },
      });
      onCleared?.(jobId);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear follow-up.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void unmark()}
        className="min-h-9 gap-1.5 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? "Clearing..." : "Done"}
      </Button>
      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}
    </div>
  );
}
