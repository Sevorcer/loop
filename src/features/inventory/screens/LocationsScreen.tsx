import { Truck } from "lucide-react";
import Link from "next/link";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";
import { listLocations, listVehicles } from "@/services/inventoryLocations";
import { listVanOperators, listVanPeople } from "@/services/vehicleOperators";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { LocationActiveToggle } from "../components/LocationActiveToggle";
import { LocationDialog } from "../components/LocationDialog";
import { VehicleDialog, type OperatorChoice } from "../components/VehicleDialog";
import { getInventoryAccess } from "../server/inventoryAccess";
import { loadCrewOptions } from "../server/loadCrewOptions";
import type { Vehicle } from "../types/ledger";
import type { VanPerson } from "../types/operators";

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

  const [vehicles, locations, crews] = await Promise.all([
    listVehicles(true),
    listLocations(true),
    loadCrewOptions(),
  ]);
  let operators: Awaited<ReturnType<typeof listVanOperators>> = [];
  let people: VanPerson[] = [];
  let peopleLoaded = false;
  try {
    [operators, people] = await Promise.all([listVanOperators(), listVanPeople()]);
    peopleLoaded = true;
  } catch {
    operators = [];
    people = [];
  }
  const crewNames = new Map(crews.map((crew) => [crew.id, crew.name]));
  const vehicleNames = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name]));
  const nameById = new Map(people.map((person) => [person.id, person.name]));
  const assignments: OperatorChoice[] = operators.map((row) => ({
    vehicleId: row.vehicleId,
    vehicleName: vehicleNames.get(row.vehicleId) ?? "Van",
    userId: row.userId,
    isHome: row.isHome,
  }));
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
        description="Each van is a stock location. The crew stays on the van. People are who open it on the phone, and each person has one home van."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={ROUTES.INVENTORY_RESTOCK}
              className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              Needs restock
            </Link>
            {access.canManageVehicles ? (
              <VehicleDialog
                crews={crews}
                people={people}
                assignments={assignments}
                peopleLoaded={peopleLoaded}
                canRemoveOperators={access.canRemoveOperators}
              />
            ) : null}
          </div>
        }
      >
        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-5 w-5" aria-hidden="true" />}
            title="No vans yet"
            description="Vans are added here by hand. Nothing is created or imported automatically, so add each truck you want to track stock on."
            action={
              access.canManageVehicles ? (
                <VehicleDialog
                  crews={crews}
                  people={people}
                  assignments={assignments}
                  peopleLoaded={peopleLoaded}
                  canRemoveOperators={access.canRemoveOperators}
                />
              ) : undefined
            }
          />
        ) : (
          <InventoryTable
            caption="Vans"
            headers={[{ label: "Van" }, { label: "Plate" }, { label: "Crew" }, { label: "People" }, { label: "Stock location" }, { label: "Status" }, { label: "Actions", srOnly: true }]}
          >
            {vehicles.map((vehicle) => {
              const status = VEHICLE_STATUS[vehicle.status];
              const vanLocation = vanLocationByVehicle.get(vehicle.id);
              const assigned = assignments.filter((row) => row.vehicleId === vehicle.id);
              const peopleLabel = assigned.length
                ? assigned
                    .map((row) => {
                      const person = nameById.get(row.userId) ?? "Inactive teammate";
                      return row.isHome ? `${person} (home)` : person;
                    })
                    .join(", ")
                : "—";
              return (
                <tr key={vehicle.id} className="transition-colors hover:bg-surface-elevated">
                  <Td className="font-medium">
                    <Link
                      href={ROUTE_BUILDERS.INVENTORY_VAN(vehicle.id)}
                      className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    >
                      {vehicle.name}
                    </Link>
                  </Td>
                  <Td className="text-muted">{vehicle.plate ?? "—"}</Td>
                  <Td className="text-muted">{(vehicle.crewId && crewNames.get(vehicle.crewId)) || "Unassigned"}</Td>
                  <Td className="text-muted">{peopleLabel}</Td>
                  <Td className="text-muted">{vanLocation ? vanLocation.name : "—"}</Td>
                  <Td><StatusBadge variant={status.variant}>{status.label}</StatusBadge></Td>
                  <Td align="right">
                    {access.canEditVehicles ? (
                      <VehicleDialog
                        vehicle={vehicle}
                        crews={crews}
                        people={people}
                        assignments={assignments}
                        peopleLoaded={peopleLoaded}
                        canRemoveOperators={access.canRemoveOperators}
                      />
                    ) : null}
                  </Td>
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
