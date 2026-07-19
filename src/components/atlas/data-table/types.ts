import {
  ColumnDef,
} from "@tanstack/react-table";

import { ReactNode } from "react";

export type DataTableColumn<TData> = ColumnDef<TData>;

export interface DataTableAction<TData> {
  label: string;

  onClick: (row: TData) => void;

  destructive?: boolean;

  disabled?: boolean;
}

export interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[];

  data: TData[];

  loading?: boolean;

  searchable?: boolean;

  searchPlaceholder?: string;

  emptyTitle?: string;

  emptyDescription?: string;

  primaryAction?: ReactNode;

  rowActions?: DataTableAction<TData>[];
}