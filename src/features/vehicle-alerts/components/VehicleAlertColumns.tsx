"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, ArrowUpDown } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { VehicleAlert, VehicleAlertStatus } from "../types/vehicleAlert";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function SortableHeader({
  label,
  column,
}: {
  label: string;
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => false | "asc" | "desc";
  };
}) {
  return (
    <Button
      variant="ghost"
      className="-ml-3"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

function getPriorityVariant(priority: VehicleAlert["priority"]) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function getStatusVariant(status: VehicleAlert["status"]) {
  if (status === "Resolved") return "success" as const;
  if (status === "Scheduled") return "warning" as const;
  if (status === "Acknowledged") return "neutral" as const;
  return "danger" as const;
}

const STATUS_TRANSITIONS: Record<VehicleAlertStatus, VehicleAlertStatus | null> = {
  New: "Acknowledged",
  Acknowledged: "Scheduled",
  Scheduled: "Resolved",
  Resolved: null,
};

const STATUS_ACTION_LABEL: Record<VehicleAlertStatus, string> = {
  New: "Acknowledge",
  Acknowledged: "Schedule",
  Scheduled: "Resolve",
  Resolved: "",
};

export function buildVehicleAlertColumns(
  onUpdateStatus: (id: string, status: VehicleAlertStatus) => void
): ColumnDef<VehicleAlert>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <SortableHeader label="Alert" column={column} />
      ),
      cell: ({ row }) => (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>

          <div>
            <div className="font-medium">{row.original.title}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.vehicleName}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Details",
      cell: ({ row }) => (
        <p className="max-w-md text-sm text-muted-foreground">
          {row.original.description}
        </p>
      ),
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <SortableHeader label="Priority" column={column} />
      ),
      cell: ({ row }) => (
        <StatusBadge variant={getPriorityVariant(row.original.priority)}>
          {row.original.priority}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <SortableHeader label="Status" column={column} />
      ),
      cell: ({ row }) => (
        <StatusBadge variant={getStatusVariant(row.original.status)}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "reportedBy",
      header: ({ column }) => (
        <SortableHeader label="Reported By" column={column} />
      ),
    },
    {
      accessorKey: "reportedAt",
      header: ({ column }) => (
        <SortableHeader label="Reported" column={column} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.reportedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const nextStatus = STATUS_TRANSITIONS[row.original.status];
        const actionLabel = STATUS_ACTION_LABEL[row.original.status];

        if (!nextStatus) {
          return (
            <span className="text-xs text-muted-foreground">Closed</span>
          );
        }

        return (
          <Button
            variant="outline"
            size="sm"
            className="min-w-[96px] text-xs"
            onClick={() => onUpdateStatus(row.original.id, nextStatus)}
          >
            {actionLabel}
          </Button>
        );
      },
    },
  ];
}

/** Static columns for backward-compat (no lifecycle actions). */
export const vehicleAlertColumns: ColumnDef<VehicleAlert>[] = buildVehicleAlertColumns(
  () => {}
);
