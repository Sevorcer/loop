"use client";

import { Link2, PackageX, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/atlas";

import { useMaterialPlan } from "../../state/MaterialPlanProvider";
import { JOB_MATERIAL_SOURCE_LABELS, type JobMaterialLine } from "../../types/jobMaterials";
import { isNeedsSku } from "../../utils/materialPlan";
import { LinkItemDialog } from "./LinkItemDialog";
import { AdjustQuantityDialog, NotStockDialog, RemoveLineDialog } from "./LineDialogs";

/** Where a plan line came from, whether it still needs a catalog item, and optional-ness. */
export function PlanLineBadges({ line }: { line: JobMaterialLine }) {
  if (line.planId === null) return null;
  const needsSku = isNeedsSku(line);
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {line.source !== "manual" ? (
        <StatusBadge variant="neutral" className="px-2 py-0.5 text-[11px]">
          {JOB_MATERIAL_SOURCE_LABELS[line.source]}
        </StatusBadge>
      ) : null}
      {needsSku ? (
        <StatusBadge variant="info" className="px-2 py-0.5 text-[11px]">
          Needs SKU
        </StatusBadge>
      ) : null}
      {line.nonStockReason ? (
        <StatusBadge variant="neutral" className="px-2 py-0.5 text-[11px]">
          Not stocked
        </StatusBadge>
      ) : null}
      {line.isOptional ? (
        <StatusBadge variant="neutral" className="px-2 py-0.5 text-[11px]">
          Optional
        </StatusBadge>
      ) : null}
    </span>
  );
}

/** Second-line detail for a plan line: the linked catalog item, kit quantity, or the not-stock reason. */
export function planLineDetail(line: JobMaterialLine): string | null {
  if (line.planId === null) return null;
  const parts: string[] = [];
  if (line.catalogItem && line.catalogItem.name !== line.name) parts.push(`Catalog: ${line.catalogItem.name}`);
  if (line.catalogItem?.sku) parts.push(`SKU ${line.catalogItem.sku}`);
  if (line.kitQuantity !== null && line.kitQuantity !== line.quantity) parts.push(`Kit asks for ${line.kitQuantity}`);
  if (line.nonStockReason) parts.push(line.nonStockReason);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const iconButton =
  "inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-atlas-md p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 sm:min-h-8 sm:min-w-8";

type Dialog = "quantity" | "remove" | "link" | "notStock" | null;

/** Office controls for one plan line. Quantity, removal and SKU decisions all ask for a reason or an item. */
export function PlanLineControls({ line, disabled }: { line: JobMaterialLine; disabled: boolean }) {
  const { adjustLine, removeLine, linkLine, markNotStock, canResolve } = useMaterialPlan();
  const [open, setOpen] = useState<Dialog>(null);
  const needsSku = isNeedsSku(line);
  const close = () => setOpen(null);

  return (
    <>
      <button type="button" className={iconButton} disabled={disabled} onClick={() => setOpen("quantity")} aria-label={`Change quantity of ${line.name}`}>
        <Pencil size={14} aria-hidden="true" />
      </button>
      {needsSku && canResolve ? (
        <>
          <button type="button" className={iconButton} disabled={disabled} onClick={() => setOpen("link")} aria-label={`Link ${line.name} to a catalog item`}>
            <Link2 size={14} aria-hidden="true" />
          </button>
          <button type="button" className={iconButton} disabled={disabled} onClick={() => setOpen("notStock")} aria-label={`Mark ${line.name} as not a stocked item`}>
            <PackageX size={14} aria-hidden="true" />
          </button>
        </>
      ) : null}
      <button type="button" className={`${iconButton} hover:text-[var(--danger)]`} disabled={disabled} onClick={() => setOpen("remove")} aria-label={`Remove ${line.name}`}>
        <Trash2 size={14} aria-hidden="true" />
      </button>

      {open === "quantity" ? (
        <AdjustQuantityDialog
          lineName={line.name}
          quantity={line.quantity}
          unit={line.unit}
          onClose={close}
          onSubmit={({ quantity, reason }) => adjustLine(line.id, { quantity, reason })}
        />
      ) : null}
      {open === "remove" ? (
        <RemoveLineDialog lineName={line.name} onClose={close} onSubmit={({ reason }) => removeLine(line.id, reason)} />
      ) : null}
      {open === "link" ? (
        <LinkItemDialog
          lineName={line.name}
          onClose={close}
          onSubmit={({ catalogItemId, writeAlias }) => linkLine(line.id, catalogItemId, writeAlias)}
        />
      ) : null}
      {open === "notStock" ? (
        <NotStockDialog lineName={line.name} onClose={close} onSubmit={({ reason }) => markNotStock(line.id, reason)} />
      ) : null}
    </>
  );
}
