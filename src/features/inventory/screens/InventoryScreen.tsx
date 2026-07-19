"use client";

import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Package,
  Truck,
  XCircle,
} from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import { MaterialPlanList } from "../components/MaterialPlanList";
import { WarehousePickList } from "../components/WarehousePickList";
import { useInventory } from "../state/InventoryProvider";

export function InventoryScreen() {
  const { snapshot } = useInventory();
  const { metrics } = snapshot;

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <Package className="h-3.5 w-3.5" />
              Inventory · Material Readiness
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Material Readiness
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Before work begins, LOOP knows whether every required material
                is available, reserved, and ready to install. Inventory exists
                to answer one question:{" "}
                <span className="font-medium text-slate-200">
                  Can this work actually happen?
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={CheckCircle2}
              value={String(metrics.readyJobs)}
              label="Jobs ready"
              variant="success"
            />
            <MetricCard
              icon={AlertTriangle}
              value={String(metrics.attentionNeededJobs)}
              label="Attention needed"
              variant="warning"
            />
            <MetricCard
              icon={XCircle}
              value={String(metrics.blockedJobs)}
              label="Blocked"
              variant="danger"
            />
            <MetricCard
              icon={Box}
              value={String(metrics.backordered)}
              label="Backordered items"
              variant="neutral"
            />
          </div>
        </div>
      </SurfaceCard>

      {/* ── Architecture Note ── */}
      <SurfaceCard>
        <div className="grid gap-6 p-6 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Material truth flows to work
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              A sold job automatically generates a Material Plan from the
              known equipment and work requirements. Inventory is allocated —
              not just counted — so the system can distinguish on-hand stock
              from material already committed to other jobs. Work orders inherit
              readiness from Inventory rather than checking it separately.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <ol className="space-y-3 text-sm text-slate-300">
              <li>1. Estimate accepted → material plan generated</li>
              <li>2. Inventory items reserved against the plan</li>
              <li>3. Warehouse picks and loads materials</li>
              <li>4. Job inherits Material Readiness state</li>
              <li>5. Crew dispatched with full truck confidence</li>
            </ol>
          </div>
        </div>
      </SurfaceCard>

      {/* ── Warehouse View ── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Truck className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">
            Warehouse — Today&apos;s Jobs
          </h3>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">
            {snapshot.warehouseCards.length} jobs
          </span>
        </div>
        <WarehousePickList />
      </div>

      {/* ── Material Plans ── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Package className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">
            Material Plans
          </h3>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">
            {snapshot.materialPlans.length} plans
          </span>
        </div>
        <MaterialPlanList />
      </div>

      {/* ── Inventory Status ── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Box className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">
            Inventory Status
          </h3>
        </div>
        <InventoryStatusGrid />
      </div>
    </div>
  );
}

function InventoryStatusGrid() {
  const { snapshot } = useInventory();
  const backordered = snapshot.inventoryItems.filter(
    (item) => item.isBackordered
  );
  const specialOrder = snapshot.inventoryItems.filter(
    (item) => item.isSpecialOrder && !item.isBackordered
  );
  const available = snapshot.inventoryItems.filter(
    (item) => !item.isBackordered && item.quantityAvailable > 0
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SurfaceCard>
        <div className="p-5">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <h4 className="text-sm font-semibold text-white">
              Backordered ({backordered.length})
            </h4>
          </div>
          <div className="mt-4 space-y-3">
            {backordered.length === 0 ? (
              <p className="text-sm text-slate-500">No backorders.</p>
            ) : (
              backordered.map((item) => (
                <div key={item.id} className="space-y-1">
                  <p className="text-sm text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.expectedArrival
                      ? `Expected ${new Date(item.expectedArrival).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : "No ETA yet"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">
              Special Orders ({specialOrder.length})
            </h4>
          </div>
          <div className="mt-4 space-y-3">
            {specialOrder.length === 0 ? (
              <p className="text-sm text-slate-500">
                No special-order items.
              </p>
            ) : (
              specialOrder.map((item) => (
                <div key={item.id} className="space-y-1">
                  <p className="text-sm text-slate-100">{item.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">
                      {item.warehouseLocation ?? "Location TBD"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">
              Available ({available.length})
            </h4>
          </div>
          <div className="mt-4 space-y-3">
            {available.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2"
              >
                <p className="text-sm text-slate-100 truncate">{item.name}</p>
                <span className="flex-shrink-0 text-xs font-semibold text-emerald-400">
                  {item.quantityAvailable} {item.unit}
                </span>
              </div>
            ))}
            {available.length > 5 && (
              <p className="text-xs text-slate-500">
                +{available.length - 5} more items available
              </p>
            )}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  variant,
}: {
  icon: typeof CheckCircle2;
  value: string;
  label: string;
  variant: "success" | "warning" | "danger" | "neutral";
}) {
  const iconColor =
    variant === "success"
      ? "text-emerald-300"
      : variant === "warning"
        ? "text-amber-300"
        : variant === "danger"
          ? "text-red-300"
          : "text-slate-400";

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Icon className={["h-4 w-4", iconColor].join(" ")} />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
