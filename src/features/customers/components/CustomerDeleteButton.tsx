"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import { ROUTES } from "@/lib/routes";

interface CustomerDeleteButtonProps {
  customerId: string;
  customerName: string;
}

export function CustomerDeleteButton({ customerId, customerName }: CustomerDeleteButtonProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    try {
      setIsDeleting(true);
      setError(null);
      await requestJson(`/api/customers/${customerId}`, {
        method: "DELETE",
        role,
      });
      router.push(ROUTES.CUSTOMERS);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete customer. Please try again.",
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
          {error ?? `Delete "${customerName}"?`}
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
      className="min-h-[44px] gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </Button>
  );
}
