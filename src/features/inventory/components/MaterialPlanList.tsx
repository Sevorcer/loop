"use client";

import { AlertTriangle, Box, CheckCircle2, Package, XCircle } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import { useInventory } from "../state/InventoryProvider";
import type { JobMaterialPlan, JobMaterialPlanItem } from "../types/inventory";
import { getPlanItemStateLabel } from "../utils/inventoryUtils";
import { MaterialReadinessBadge } from "./MaterialReadinessBadge";

function ItemStateIndicator({ state }: { state: JobMaterialPlanItem["state"] }) {
  if (state === "loaded" || state === "installed" || state === "consumed") {
    return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />;
  }
  if (state === "picked") {
    return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-blue-400" />;
  }
  if (state === "reserved" || state === "allocated") {
    return <Box className="h-4 w-4 flex-shrink-0 text-slate-400" />;
  }
  if (state === "missing") {
    return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />;
  }
  if (state === "blocked") {
    return <XCircle className="h-4 w-4 flex-shrink-0 text-red-400" />;
  }
  return <Package className="h-4 w-4 flex-shrink-0 text-slate-500" />;
}

function itemStateTextColor(state: JobMaterialPlanItem["state"]) {
  if (state === "loaded" || state === "installed" || state === "consumed")
    return "text-emerald-300";
  if (state === "picked") return "text-blue-300";
  if (state === "missing") return "text-amber-300";
  if (state === "blocked") return "text-red-300";
  return "text-slate-400";
}

function PlanItemRow({ item }: { item: JobMaterialPlanItem }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <ItemStateIndicator state={item.state} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-slate-100">{item.itemName}</span>
          <span
            className={[
              "text-xs font-medium uppercase tracking-[0.12em]",
              itemStateTextColor(item.state),
            ].join(" ")}
          >
            {getPlanItemStateLabel(item.state)}
          </span>
          {item.isSpecialOrder && (
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-px text-xs font-semibold text-violet-300">
              Special Order
            </span>
          )}
        </div>
        {item.notes && (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.notes}</p>
        )}
      </div>
      <span className="flex-shrink-0 text-xs text-slate-500">
        {item.category}
      </span>
    </div>
  );
}

function MaterialPlanCard({ plan }: { plan: JobMaterialPlan }) {
  const loadedCount = plan.items.filter(
    (item) =>
      item.state === "loaded" ||
      item.state === "installed" ||
      item.state === "consumed"
  ).length;

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <MaterialReadinessBadge state={plan.readinessState} />
              <span className="text-xs text-slate-500">
                {plan.jobNumber}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {plan.propertyName}
            </h3>
            <p className="text-sm text-slate-400">{plan.customerName}</p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Scheduled
            </p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {new Date(plan.scheduledFor).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {loadedCount} / {plan.items.length} items loaded
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-white/[0.04]">
          {plan.items.map((item) => (
            <PlanItemRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function MaterialPlanList() {
  const { snapshot } = useInventory();

  return (
    <div className="space-y-4">
      {snapshot.materialPlans.map((plan) => (
        <MaterialPlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
