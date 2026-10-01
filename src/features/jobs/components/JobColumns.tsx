"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Briefcase, Wrench } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { formatScheduledShort } from "@/features/jobs/utils/schedulingTime";

import type { Job } from "../types/job";

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

function getStatusVariant(status: Job["status"]) {
  if (status === "Completed") return "success" as const;
  if (status === "Scheduled") return "info" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "On Hold") return "neutral" as const;
  return "danger" as const;
}

function getPriorityVariant(priority: Job["priority"]) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function getTypeIcon(type: Job["type"]) {
  if (type === "Service" || type === "Maintenance") {
    return <Wrench className="h-4 w-4 text-blue-300" />;
  }

  return <Briefcase className="h-4 w-4 text-red-300" />;
}

function formatListDateRange(job: Job): string | null { const startValue = job.scheduledStartAt ?? job.scheduledFor; if (!startValue || !job.scheduledEndAt) { return null; } const start = new Date(startValue); const end = new Date(job.scheduledEndAt); if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) { return null; } const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }); return monthDay.format(start) + " – " + monthDay.format(end) + ", " + yearFmt.format(end); } export const jobColumns: ColumnDef<Job>[] = [
  {
    accessorKey: "jobNumber",
    meta: {
      mobileLabel: "Job",
      mobilePrimary: true,
    },
    header: ({ column }) => (
      <SortableHeader label="Job #" column={column} />
    ),
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-white">{row.original.jobNumber}</div>
        <div className="text-xs text-slate-400">{row.original.title}</div>
      </div>
    ),
  },
  {
    accessorKey: "type",
    meta: {
      mobileLabel: "Type",
    },
    header: ({ column }) => (
      <SortableHeader label="Type" column={column} />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
          {getTypeIcon(row.original.type)}
        </div>
        <span className="text-sm text-slate-200">{row.original.type}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    meta: {
      mobileLabel: "Status",
    },
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
    accessorKey: "priority",
    meta: {
      mobileLabel: "Priority",
    },
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
    accessorKey: "customerName",
    meta: {
      mobileLabel: "Customer",
    },
    header: ({ column }) => (
      <SortableHeader label="Customer" column={column} />
    ),
  },
  {
    accessorKey: "propertyName",
    meta: {
      mobileLabel: "Property",
    },
    header: ({ column }) => (
      <SortableHeader label="Property" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-slate-300">{row.original.propertyName}</span>
    ),
  },
  {
    accessorKey: "assignedTo",
    meta: {
      mobileLabel: "Assigned To",
      // F14: redundant on a phone card for the tech's own jobs; the status,
      // schedule, customer, and property carry the card.
      mobileHidden: true,
    },
    header: ({ column }) => (
      <SortableHeader label="Assigned To" column={column} />
    ),
  },
  {
    // Sort by scheduledStartAt when available, fall back to scheduledFor
    id: "scheduledStart",
    accessorFn: (row) => row.scheduledStartAt ?? row.scheduledFor,
    meta: {
      mobileLabel: "Scheduled",
    },
    header: ({ column }) => (
      <SortableHeader label="Scheduled" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-slate-400">
        {formatListDateRange(row.original) ?? formatScheduledShort(row.original.scheduledStartAt ?? row.original.scheduledFor)}
      </span>
    ),
  },
];
