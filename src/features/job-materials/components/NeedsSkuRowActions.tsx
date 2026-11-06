"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { ActionResult } from "../state/MaterialPlanProvider";
import { NotStockDialog } from "./plan/LineDialogs";
import { LinkItemDialog } from "./plan/LinkItemDialog";

interface NeedsSkuRowActionsProps {
  jobId: string;
  lineId: string;
  lineName: string;
}

/** Resolve one needs-SKU line from the queue: link it to a catalog item, or mark it not stocked. */
export function NeedsSkuRowActions({ jobId, lineId, lineName }: NeedsSkuRowActionsProps) {
  const { role } = useCurrentRole();
  const router = useRouter();
  const [open, setOpen] = useState<"link" | "not_stock" | null>(null);

  async function patch(body: Record<string, unknown>, fallback: string): Promise<ActionResult> {
    if (!role) return { ok: false, message: "Sign in again to continue." };
    try {
      await requestJson(
        `/api/jobs/${encodeURIComponent(jobId)}/material-plan/lines/${encodeURIComponent(lineId)}`,
        { role, method: "PATCH", body },
      );
      router.refresh();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error && error.message ? error.message : fallback };
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen("link")}>
        Link item
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen("not_stock")}>
        Not stocked
      </Button>
      {open === "link" ? (
        <LinkItemDialog
          lineName={lineName}
          onClose={() => setOpen(null)}
          onSubmit={({ catalogItemId, writeAlias }) =>
            patch({ action: "link", catalogItemId, writeAlias }, "Could not link the item.")
          }
        />
      ) : null}
      {open === "not_stock" ? (
        <NotStockDialog
          lineName={lineName}
          onClose={() => setOpen(null)}
          onSubmit={({ reason }) => patch({ action: "not_stock", reason }, "Could not save that.")}
        />
      ) : null}
    </div>
  );
}
