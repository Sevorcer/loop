"use client";

import { useMemo, useState } from "react";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type MobileColumnMeta = {
  mobileLabel?: string;
  mobilePrimary?: boolean;
  mobileHidden?: boolean;
};

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
}

function getColumnMeta<TData>(columnDef: ColumnDef<TData, unknown>): MobileColumnMeta {
  return (columnDef.meta as MobileColumnMeta | undefined) ?? {};
}

function humanizeLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function DataTable<TData>({
  columns,
  data,
  onRowClick,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const humanizedLabelCache = useMemo(() => new Map<string, string>(), []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  const totalRows = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const pagination = table.getState().pagination;

  const startRow =
    totalRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;

  const endRow =
    totalRows === 0
      ? 0
      : Math.min(
          pagination.pageIndex * pagination.pageSize + pageRows.length,
          totalRows
        );

  function handleRowClick(row: Row<TData>) {
    if (!onRowClick) return;
    onRowClick(row.original);
  }

  function getMobileLabel(cell: Cell<TData, unknown>) {
    const meta = getColumnMeta(cell.column.columnDef);
    if (meta.mobileLabel) {
      return meta.mobileLabel;
    }

    const header = cell.column.columnDef.header;
    if (typeof header === "string") {
      return header;
    }

    const rawLabel =
      "accessorKey" in cell.column.columnDef &&
      typeof cell.column.columnDef.accessorKey === "string"
        ? cell.column.columnDef.accessorKey
        : cell.column.id;

    const cached = humanizedLabelCache.get(rawLabel);
    if (cached) {
      return cached;
    }

    const humanized = humanizeLabel(rawLabel);
    humanizedLabelCache.set(rawLabel, humanized);
    return humanized;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="space-y-3 p-4 md:hidden">
          {pageRows.length === 0 ? (
            <div className="text-muted rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
              No records found.
            </div>
          ) : (
            pageRows.map((row) => {
              const mobileCells = row
                .getVisibleCells()
                .filter((cell) => !getColumnMeta(cell.column.columnDef).mobileHidden);

              const primaryCell =
                mobileCells.find((cell) => getColumnMeta(cell.column.columnDef).mobilePrimary) ??
                mobileCells[0];

              const detailCells = mobileCells.filter((cell) => cell.id !== primaryCell?.id);

              return (
                <div
                  key={row.id}
                  className={[
                    "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
                    onRowClick ? "cursor-pointer transition-colors hover:bg-white/[0.05]" : "",
                  ].join(" ")}
                  onClick={() => handleRowClick(row)}
                  onKeyDown={(event) => {
                    if (!onRowClick) {
                      return;
                    }

                    if (event.key === "Enter") {
                      handleRowClick(row);
                      return;
                    }

                    if (event.key === " ") {
                      event.preventDefault();
                      handleRowClick(row);
                    }
                  }}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {primaryCell ? (
                    <div className="min-w-0">
                      {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
                    </div>
                  ) : null}

                  {detailCells.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {detailCells.map((cell) => (
                        <div key={cell.id} className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {getMobileLabel(cell)}
                          </p>
                          <div className="text-sm text-primary">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <thead className="bg-surface-elevated">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-default border-b px-6 py-4 text-left text-sm font-semibold text-primary"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-muted py-16 text-center"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className={onRowClick ? "hover-surface transition-atlas cursor-pointer" : "hover-surface transition-atlas"}
                    onClick={() => handleRowClick(row)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border-default border-b px-6 py-4 text-sm"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            Showing {startRow}-{endRow} of {totalRows}{" "}
            {totalRows === 1 ? "result" : "results"}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}