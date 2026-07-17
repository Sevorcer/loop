"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Building2, MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { Property } from "../types/property";

export const propertyColumns: ColumnDef<Property>[] = [
  {
    accessorKey: "name",
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
            {row.original.city}
          </div>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "customer",
    header: "Customer",
  },

  {
    accessorKey: "city",
    header: "City",
  },

  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      const variant =
        status === "Active"
          ? "success"
          : status === "Pending"
          ? "warning"
          : "neutral";

      return (
        <StatusBadge variant={variant}>
          {status}
        </StatusBadge>
      );
    },
  },

  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Created
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);

      return (
        <span className="text-sm text-muted-foreground">
          {date.toLocaleDateString()}
        </span>
      );
    },
  },

  {
    id: "actions",
    enableHiding: false,
    cell: () => (
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    ),
  },
];