"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import { ROUTES } from "@/lib/routes";

import { useInstalledSystems } from "../state/InstalledSystemsProvider";

interface InstalledSystemDeleteButtonProps {
  systemId: string;
  systemName: string;
}

export function InstalledSystemDeleteButton({
  systemId,
  systemName,
}: InstalledSystemDeleteButtonProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const { refreshSystems } = useInstalledSystems();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    try {
      setIsDeleting(true);
      setError(null);
      await requestJson(`/api/installed-systems/${systemId}`, {
        method: "DELETE",
        role,
      });
      await refreshSystems();
      router.push(ROUTES.INSTALLED_SYSTEMS);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete. Please try again.",
      );
      setIsDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
        <span className="text-sm text-red-300">
          {error ?? `Delete "${systemName}"?`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-red-400 hover:bg-red-500/20 hover:text-red-300"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting…" : "Confirm"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-slate-400 hover:text-slate-200"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </Button>
  );
}
