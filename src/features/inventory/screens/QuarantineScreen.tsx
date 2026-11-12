import { PackageCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTES } from "@/lib/routes";
import { listLocations } from "@/services/inventoryLocations";
import { listSerialUnits } from "@/services/inventorySerialUnits";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { RmaActions } from "../components/RmaActions";
import { getInventoryAccess } from "../server/inventoryAccess";
import { rmaActionsFor } from "../utils/serialRules";

const linkClass =
  "rounded-atlas-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";

const MAX_SEARCH_LENGTH = 64;

function searchTerm(params: Record<string, string | string[] | undefined> | undefined): string {
  const raw = params?.q;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
}

interface QuarantineScreenProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * RMA: units that failed or came back. A unit leaves service through quarantine, then is
 * repaired back into stock, returned to the supplier or scrapped. The database makes the
 * stock entries; nothing here edits a status directly.
 */
export async function QuarantineScreen({ searchParams }: QuarantineScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canReviewSerials) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Quarantine is not available for your role" />
      </InventoryFrame>
    );
  }

  const query = searchTerm(await searchParams);
  const [quarantined, matches, locations] = await Promise.all([
    listSerialUnits({ status: "quarantine", limit: 500 }),
    query ? listSerialUnits({ search: query, limit: 25 }) : Promise.resolve([]),
    listLocations(false),
  ]);

  const locationName = new Map(locations.map((location) => [location.id, location.name]));
  const stockLocations = locations
    .filter((location) => location.type !== "quarantine" && location.type !== "job")
    .map((location) => ({ id: location.id, name: location.name }));
  const quarantineLocations = locations
    .filter((location) => location.type === "quarantine")
    .map((location) => ({ id: location.id, name: location.name }));
  const candidates = matches.filter((unit) => rmaActionsFor(unit.status).includes("quarantine"));

  return (
    <InventoryFrame
      title="Inventory"
      description="Units that failed or came back. Quarantine first; then repair, return or scrap."
      actions={
        <Link href={ROUTES.INVENTORY_SERIALS} className={`${linkClass} text-sm text-muted`}>
          Back to serial review
        </Link>
      }
    >
      <SectionCard
        title="Quarantine a unit"
        description="Find the unit by serial or model. A unit in stock or installed can be sent to quarantine."
      >
        <form method="get" className="flex flex-wrap items-end gap-2" role="search">
          <label className="text-xs text-muted">
            Serial or model
            <input
              name="q"
              defaultValue={query}
              maxLength={MAX_SEARCH_LENGTH}
              spellCheck={false}
              className="mt-1 block w-64 rounded-atlas-md border border-default bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </label>
          <button
            type="submit"
            className="rounded-atlas-md border border-default px-3 py-2 text-sm text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            Find
          </button>
        </form>

        {query ? (
          candidates.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No unit in stock or installed matches “{query}”. A unit already in quarantine is listed below.
            </p>
          ) : (
            <div className="mt-4">
              <InventoryTable
                caption={`Units matching ${query}`}
                headers={[
                  { label: "Serial" },
                  { label: "Model" },
                  { label: "Where" },
                  { label: "Actions", srOnly: true },
                ]}
              >
                {candidates.map((unit) => (
                  <tr key={unit.id} className="transition-colors hover:bg-surface-elevated">
                    <Td>{unit.serialNumber}</Td>
                    <Td>{[unit.manufacturer, unit.modelNumber].filter(Boolean).join(" ") || "—"}</Td>
                    <Td>
                      {unit.status === "installed"
                        ? unit.installedSystemId
                          ? "Installed on a system"
                          : "Installed"
                        : (unit.locationId && locationName.get(unit.locationId)) || "In stock"}
                    </Td>
                    <Td align="right">
                      <RmaActions
                        unitId={unit.id}
                        serialNumber={unit.serialNumber}
                        actions={rmaActionsFor(unit.status)}
                        stockLocations={stockLocations}
                        quarantineLocations={quarantineLocations}
                      />
                    </Td>
                  </tr>
                ))}
              </InventoryTable>
            </div>
          )
        ) : null}
      </SectionCard>

      <SectionCard
        title="In quarantine"
        description={
          quarantined.length === 0
            ? undefined
            : `${quarantined.length} ${quarantined.length === 1 ? "unit" : "units"} held. Each one ends repaired, returned or scrapped.`
        }
      >
        {quarantined.length === 0 ? (
          <EmptyState
            icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
            title="Nothing in quarantine"
            description="Units that fail or come back are held here until they are dealt with."
          />
        ) : (
          <InventoryTable
            caption="Units in quarantine"
            headers={[
              { label: "Serial" },
              { label: "Model" },
              { label: "Held at" },
              { label: "Status" },
              { label: "Actions", srOnly: true },
            ]}
          >
            {quarantined.map((unit) => (
              <tr key={unit.id} className="transition-colors hover:bg-surface-elevated">
                <Td>{unit.serialNumber}</Td>
                <Td>{[unit.manufacturer, unit.modelNumber].filter(Boolean).join(" ") || "—"}</Td>
                <Td>{(unit.locationId && locationName.get(unit.locationId)) || "Quarantine"}</Td>
                <Td>
                  <StatusBadge variant="warning">
                    <ShieldAlert className="mr-1 h-3 w-3" aria-hidden="true" />
                    Quarantined
                  </StatusBadge>
                </Td>
                <Td align="right">
                  <RmaActions
                    unitId={unit.id}
                    serialNumber={unit.serialNumber}
                    actions={rmaActionsFor(unit.status)}
                    stockLocations={stockLocations}
                    quarantineLocations={quarantineLocations}
                  />
                </Td>
              </tr>
            ))}
          </InventoryTable>
        )}
      </SectionCard>
    </InventoryFrame>
  );
}
