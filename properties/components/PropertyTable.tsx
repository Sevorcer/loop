"use client";

import { DataTable } from "@/components/atlas";

import { mockProperties } from "../data/mockProperties";
import { PropertyToolbar } from "./PropertyToolbar";
import { propertyColumns } from "./PropertyColumns";

export function PropertyTable() {
  return (
    <div className="space-y-4">
      <PropertyToolbar />

      <DataTable
        columns={propertyColumns}
        data={mockProperties}
      />
    </div>
  );
}