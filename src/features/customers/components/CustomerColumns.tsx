"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Users } from "lucide-react";

import { PhoneLink, StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/dates";

import type { Customer } from "../types/customer";

function formatDate(value: string) {
  return formatDateOnly(value);
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

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "name",
    // F14: mobile card view (atlas DataTable) renders all columns as detail
    // cells by default — curate which survive on a 390px phone card.
    meta: { mobileLabel: "Customer", mobilePrimary: true },
    header: ({ column }) => (
      <SortableHeader label="Customer" column={column} />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40">
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>

        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.primaryContact}
          </div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "city",
    meta: { mobileLabel: "Contact" },
    header: ({ column }) => <SortableHeader label="City" column={column} />,
    cell: ({ row }) => (
      <div>
        <div>{row.original.email}</div>
        <div className="text-xs text-muted-foreground">{row.original.city}</div>
      </div>
    ),
  },
  {
    accessorKey: "phone",
    meta: { mobileLabel: "Phone" },
    header: "Phone",
    cell: ({ row }) =>
      row.original.phone ? (
        <PhoneLink
          phone={row.original.phone}
          className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
        />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "status",
    meta: { mobileLabel: "Status" },
    header: ({ column }) => <SortableHeader label="Status" column={column} />,
    cell: ({ row }) => {
      const status = row.original.status;

      const variant =
        status === "Active"
          ? "success"
          : status === "Prospect"
            ? "warning"
            : "neutral";

      return <StatusBadge variant={variant}>{status}</StatusBadge>;
    },
  },
  {
    accessorKey: "propertyCount",
    meta: { mobileLabel: "Properties" },
    header: ({ column }) => (
      <SortableHeader label="Properties" column={column} />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.propertyCount}</span>
    ),
  },
  {
    accessorKey: "openJobs",
    meta: { mobileLabel: "Open Jobs" },
    header: ({ column }) => (
      <SortableHeader label="Open Jobs" column={column} />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.openJobs}</span>
    ),
  },
  {
    accessorKey: "lastActivity",
    meta: { mobileLabel: "Last Activity", mobileHidden: true },
    header: ({ column }) => (
      <SortableHeader label="Last Activity" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.lastActivity)}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    meta: { mobileLabel: "Created", mobileHidden: true },
    header: ({ column }) => (
      <SortableHeader label="Created" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
];