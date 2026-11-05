import { Truck } from "lucide-react";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { listLocations, listVehicles } from "@/services/inventoryLocations";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { LocationActiveToggle } from "../components/LocationActiveToggle";
import { LocationDialog } from "../components/LocationDialog";
import { VehicleDialog } from "../components/VehicleDialog";
import { getInventoryAccess } from "../server/inventoryAccess";
import { loadCrewOptions } from "../server/loadCrewOptions";
import type { Vehicle } from "../types/ledger";

const VEHICLE_STATUS: Record<Vehicle["status"], { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Active", variant: "success" },
  out_of_service: { label: "Out of service", variant: "warning" },
  retired: { label: "Retired", variant: "neutral" },
};

const LOCATION_TYPE_LABEL = { warehouse: "Warehouse", van: "Van", quarantine: "Quarantine / RMA", job: "Job" } as const;

/** Locations & vans. Vans are only ever added by hand here; nothing is auto-created or seeded. */
export async function LocationsScreen() {
  const access = await getInventoryAccess();
  if (!access.canViewLocations) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Locations are not available for your role" />
      </InventoryFrame>
    );
  }

  const [vehicles, locations, crews] = await Promise.all([listVehicles(true), listLocations(true), loadCrewOptions()]);
  const crewNames = new Map(crews.map((crew) => [crew.id, crew.name]));
  const vanLocationByVehicle = new Map(
    locations.filter((location) => location.vehicleId).map((location) => [location.vehicleId as string, location]),
  );
  const stockLocations = locations.filter((location) => location.type === "warehouse" || location.type === "quarantine");

  return (
    <InventoryFrame
      title="Inventory"
      description="Where stock lives: your warehouse, each van, and quarantine."
      actions={access.canManageLocations ? <LocationDialog /> : undefined}
    >
      <SectionCard
        title="Vans"
        description="Each van is a stock location. Assign a crew so dispatch and inventory agree on which truck is whose."
        actions={access.canManageVehicles ? <VehicleDialog crews={crews} /> : undefined}
      >
        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-5 w-5" aria-hidden="true" />}
            title="No vans yet"
            description="Vans are added here by hand. Nothing is created or imported automatically, so add each truck you want to track stock on."
            action={access.canManageVehicles ? <VehicleDialog crews={crews} /> : undefined}
          />
        ) : (
          <InventoryTable
            caption="Vans"
            headers={[{ label: "Van" }, { label: "Plate" }, { label: "Crew" }, { label: "Stock location" }, { label: "Status" }, { label: "Actions", srOnly: true }]}
          >
            {vehicles.map((vehicle) => {
              const status = VEHICLE_STATUS[vehicle.status];
              const vanLocation = vanLocationByVehicle.get(vehicle.id);
              return (
                <tr key={vehicle.id} className="transition-colors hover:bg-surface-elevated">
                  <Td className="font-medium">{vehicle.name}</Td>
                  <Td className="text-muted">{vehicle.plate ?? "—"}</Td>
                  <Td className="text-muted">{(vehicle.crewId && crewNames.get(vehicle.crewId)) || "Unassigned"}</Td>
                  <Td className="text-muted">{vanLocation ? vanLocation.name : "—"}</Td>
                  <Td><StatusBadge variant={status.variant}>{status.label}</StatusBadge></Td>
                  <Td align="right">{access.canEditVehicles ? <VehicleDialog vehicle={vehicle} crews={crews} /> : null}</Td>
                </tr>
              );
            })}
          </InventoryTable>
        )}
      </SectionCard>

      <SectionCard title="Warehouse and quarantine" description="Shared stock locations. Deactivating hides a location from pickers; its history stays.">
        {stockLocations.length === 0 ? (
          <EmptyState
            title="No warehouse yet"
            description="Add your warehouse so you can receive stock and transfer it to vans."
            action={access.canManageLocations ? <LocationDialog /> : undefined}
          />
        ) : (
          <InventoryTable
            caption="Warehouse and quarantine locations"
            headers={[{ label: "Name" }, { label: "Type" }, { label: "Address" }, { label: "Status" }, { label: "Actions", srOnly: true }]}
          >
            {stockLocations.map((location) => (
              <tr key={location.id} className="transition-colors hover:bg-surface-elevated">
                <Td className="font-medium">{location.name}</Td>
                <Td className="text-muted">{LOCATION_TYPE_LABEL[location.type]}</Td>
                <Td className="text-muted">{location.address ?? "—"}</Td>
                <Td>{location.isActive ? <StatusBadge variant="success">Active</StatusBadge> : <StatusBadge variant="neutral">Inactive</StatusBadge>}</Td>
                <Td align="right">
                  {access.canEditLocations ? <LocationActiveToggle locationId={location.id} name={location.name} isActive={location.isActive} /> : null}
                </Td>
              </tr>
            ))}
          </InventoryTable>
        )}
      </SectionCard>
    </InventoryFrame>
  );
}
