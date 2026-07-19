"use client";

import { AlertTriangle, CheckCircle2, Package, Truck, XCircle } from "lucide-react";

import { useInventory } from "../state/InventoryProvider";
import type { WarehouseJobCard } from "../types/inventory";
import { getWarehouseStatusLabel } from "../utils/inventoryUtils";
import { MaterialReadinessBadge } from "./MaterialReadinessBadge";

function WarehouseStatusIcon({ status }: { status: WarehouseJobCard["status"] }) {
  if (status === "loaded") return <Truck className="h-5 w-5 text-emerald-400" />;
  if (status === "pick_complete") return <CheckCircle2 className="h-5 w-5 text-blue-400" />;
  if (status === "picking_in_progress") return <Package className="h-5 w-5 text-blue-300" />;
  if (status === "blocked") return <XCircle className="h-5 w-5 text-red-400" />;
  return <Package className="h-5 w-5 text-slate-400" />;
}

function warehouseStatusStyle(status: WarehouseJobCard["status"]): string {
  if (status === "loaded") return "border-emerald-500/15 bg-emerald-500/5";
  if (status === "pick_complete") return "border-blue-500/15 bg-blue-500/5";
  if (status === "picking_in_progress") return "border-blue-500/15 bg-blue-500/5";
  if (status === "blocked") return "border-red-500/15 bg-red-500/5";
  return "border-white/10 bg-white/[0.02]";
}

function WarehouseJobRow({ card }: { card: WarehouseJobCard }) {
  return (
    <div
      className={[
        "flex flex-col gap-4 rounded-2xl border p-5 transition-colors sm:flex-row sm:items-center",
        warehouseStatusStyle(card.status),
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60">
          <WarehouseStatusIcon status={card.status} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{card.jobNumber}</p>
          <p className="text-xs text-slate-400">{card.propertyName}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-3 sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-200">{card.customerName}</p>
          <p className="text-xs text-slate-500">
            Scheduled{" "}
            {new Date(card.scheduledFor).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MaterialReadinessBadge state={card.readinessState} />
          <span className="text-xs text-slate-400">
            {getWarehouseStatusLabel(card.status)}
          </span>
        </div>

        <div className="flex gap-4 text-center">
          <Stat label="Items" value={String(card.totalItems)} />
          <Stat
            label="Picked"
            value={`${card.pickedItems}/${card.totalItems}`}
            highlight={card.pickedItems === card.totalItems}
          />
          {card.specialOrderItems > 0 && (
            <Stat
              label="Special Order"
              value={String(card.specialOrderItems)}
              warning
            />
          )}
          {card.backorderedItems > 0 && (
            <Stat
              label="Backorder"
              value={String(card.backorderedItems)}
              danger
            />
          )}
        </div>
      </div>

      {card.status === "blocked" && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
          <span className="text-xs font-medium text-red-300">
            Cannot dispatch — blocked
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  warning,
  danger,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  const valueColor = danger
    ? "text-red-400"
    : warning
      ? "text-amber-400"
      : highlight
        ? "text-emerald-400"
        : "text-slate-200";

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={["mt-0.5 text-sm font-semibold", valueColor].join(" ")}>
        {value}
      </p>
    </div>
  );
}

export function WarehousePickList() {
  const { snapshot } = useInventory();

  return (
    <div className="space-y-3">
      {snapshot.warehouseCards.map((card) => (
        <WarehouseJobRow key={card.jobId} card={card} />
      ))}
    </div>
  );
}
