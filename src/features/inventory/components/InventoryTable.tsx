import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { tableCellClass, tableHeadClass } from "./formStyles";

interface InventoryTableProps {
  caption: string;
  headers: { label: string; align?: "left" | "right"; srOnly?: boolean }[];
  children: ReactNode;
}

/** Server-rendered semantic table (no client JS, so server-only columns stay server-only). */
export function InventoryTable({ caption, headers, children }: InventoryTableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-atlas-md border border-default">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-elevated">
          <tr>
            {headers.map((header) => (
              <th key={header.label} scope="col" className={cn(tableHeadClass, header.align === "right" && "text-right")}>
                {header.srOnly ? <span className="sr-only">{header.label}</span> : header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, align, className }: { children: ReactNode; align?: "right"; className?: string }) {
  return <td className={cn(tableCellClass, align === "right" && "text-right tabular-nums", className)}>{children}</td>;
}
