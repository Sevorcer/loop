"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Building2, MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { joinAddressParts } from "@/lib/address";
import { formatDateOnly } from "@/lib/dates";

import type { Property } from "../types/property";

function formatDate(value: string) {
  return formatDateOnly(value);
}

export const propertyColumns: ColumnDef<Property>[] = [
  {
    accessorKey: "name",
    meta: {
      mobileLabel: "Property",
      mobilePrimary: true,
    },
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Property
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>

        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.customer}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "address",
    accessorFn: (property) => joinAddressParts([property.address, property.city]),
    meta: {
      mobileLabel: "Address",
      hideWhenBlank: true,
    },
    header: "Address",
    cell: ({ getValue }) => {
      const addressLine = getValue<string>();
      return addressLine ? <div>{addressLine}</div> : null;
    },
  },
  {
    accessorKey: "type",
    meta: {
      mobileLabel: "Type",
    },
    header: "Type",
  },
  {
    accessorKey: "status",
    meta: {
      mobileLabel: "Status",
    },
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      const variant =
        status === "Active"
          ? "success"
          : status === "Pending"
            ? "warning"
            : "neutral";

      return <StatusBadge variant={variant}>{status}</StatusBadge>;
    },
  },
  {
    accessorKey: "primarySystem",
    meta: {
      mobileLabel: "Primary System",
      hideWhenBlank: true,
    },
    header: "Primary System",
    cell: ({ row }) => {
      const system = row.original.primarySystem?.trim();
      return system ? (
        <span className="text-sm text-muted-foreground">{system}</span>
      ) : null;
    },
  },
  {
    accessorKey: "openJobs",
    meta: {
      mobileLabel: "Open Jobs",
    },
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Open Jobs
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.openJobs}</span>
    ),
  },
  {
    accessorKey: "lastVisit",
    meta: {
      mobileLabel: "Last Visit",
    },
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Last Visit
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.lastVisit)}
      </span>
    ),
  },
  {
    id: "actions",
    meta: {
      mobileHidden: true,
    },
    enableHiding: false,
    cell: () => (
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    ),
  },
];