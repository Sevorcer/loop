"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
}

export function DataTable<TData>({
  columns,
  data,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card>

      <CardContent className="overflow-x-auto p-0">

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

            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted py-16 text-center"
                >
                  No records found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover-surface transition-atlas"
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

      </CardContent>

    </Card>
  );
}