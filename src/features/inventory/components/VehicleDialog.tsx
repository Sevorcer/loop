"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { VEHICLE_STATUSES, type Vehicle } from "../types/ledger";
import type { VanPerson } from "../types/operators";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

export interface CrewOption {
  id: string;
  name: string;
}

export interface OperatorChoice {
  vehicleId: string;
  vehicleName: string;
  userId: string;
  isHome: boolean;
}

interface VehicleDialogProps {
  /** Omit to add a new van; pass a vehicle to edit it. */
  vehicle?: Vehicle;
  crews: CrewOption[];
  people?: VanPerson[];
  /** Every van assignment, so a home van on another truck can be named. */
  assignments?: OperatorChoice[];
  peopleLoaded?: boolean;
  canRemoveOperators?: boolean;
}

const STATUS_LABELS: Record<Vehicle["status"], string> = {
  active: "Active",
  out_of_service: "Out of service",
  retired: "Retired",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  dispatch: "Dispatch",
  tech: "Tech",
  office: "Office",
  sales: "Sales",
};

export function VehicleDialog({
  vehicle,
  crews,
  people = [],
  assignments = [],
  peopleLoaded = false,
  canRemoveOperators = false,
}: VehicleDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {vehicle ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Edit ${vehicle.name}`}>
          <Pencil size={14} aria-hidden="true" />
          Edit
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          Add van
        </Button>
      )}
      {open ? (
        <VehicleForm
          vehicle={vehicle}
          crews={crews}
          people={people}
          assignments={assignments}
          peopleLoaded={peopleLoaded}
          canRemoveOperators={canRemoveOperators}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function VehicleForm({
  vehicle,
  crews,
  people = [],
  assignments = [],
  peopleLoaded = false,
  canRemoveOperators = false,
  onClose,
}: VehicleDialogProps & { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [name, setName] = useState(vehicle?.name ?? "");
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [vin, setVin] = useState(vehicle?.vin ?? "");
  const [status, setStatus] = useState<Vehicle["status"]>(vehicle?.status ?? "active");
  const [crewId, setCrewId] = useState(vehicle?.crewId ?? "");
  const [notes, setNotes] = useState(vehicle?.notes ?? "");

  const mine = assignments.filter((row) => vehicle && row.vehicleId === vehicle.id);
  const knownIds = new Set(people.map((person) => person.id));
  const extras = mine.filter((row) => !knownIds.has(row.userId));
  const initialIds = new Set(mine.map((row) => row.userId));

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(mine.map((row) => [row.userId, true])),
  );
  const [homes, setHomes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(mine.map((row) => [row.userId, row.isHome])),
  );

  function homeVanName(userId: string): string | null {
    const other = assignments.find((row) => row.userId === userId && row.isHome && row.vehicleId !== vehicle?.id);
    return other?.vehicleName ?? null;
  }

  function togglePerson(userId: string, on: boolean) {
    setSelected((current) => ({ ...current, [userId]: on }));
    if (on && homes[userId] === undefined) {
      setHomes((current) => ({ ...current, [userId]: homeVanName(userId) ? false : true }));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the van a name, like “Van 2”.");
    const body: Record<string, unknown> = {
      name: name.trim(),
      plate: plate.trim() || null,
      vin: vin.trim() || null,
      status,
      crewId: crewId || null,
      notes: notes.trim() || null,
    };
    if (peopleLoaded) {
      const ids = [...people.map((person) => person.id), ...extras.map((row) => row.userId)];
      body.operators = ids
        .filter((userId) => selected[userId])
        .map((userId) => ({ userId, isHome: homes[userId] === true }));
    }
    const result = vehicle
      ? await run(`/api/inventory/vehicles/${vehicle.id}`, "PATCH", body)
      : await run("/api/inventory/vehicles", "POST", body);
    if (result.ok) onClose();
  }

  const roster = [
    ...people.map((person) => ({ id: person.id, name: person.name, role: person.role })),
    ...extras.map((row) => ({ id: row.userId, name: "Inactive teammate", role: "" })),
  ];

  return (
    <DialogShell
      title={vehicle ? `Edit ${vehicle.name}` : "Add van"}
      description={vehicle ? "Crew and the people who open this van are saved separately." : "Adding a van also creates its stock location."}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Name" htmlFor="vehicle-name">
          <input id="vehicle-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} maxLength={100} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Plate (optional)" htmlFor="vehicle-plate">
            <input id="vehicle-plate" value={plate} onChange={(e) => setPlate(e.target.value)} className={fieldClass} />
          </FormField>
          <FormField label="VIN (optional)" htmlFor="vehicle-vin">
            <input id="vehicle-vin" value={vin} onChange={(e) => setVin(e.target.value)} className={fieldClass} />
          </FormField>
          <FormField label="Status" htmlFor="vehicle-status">
            <select id="vehicle-status" value={status} onChange={(e) => setStatus(e.target.value as Vehicle["status"])} className={fieldClass}>
              {VEHICLE_STATUSES.map((value) => (
                <option key={value} value={value}>{STATUS_LABELS[value]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Assigned crew" htmlFor="vehicle-crew">
            <select id="vehicle-crew" value={crewId} onChange={(e) => setCrewId(e.target.value)} className={fieldClass}>
              <option value="">Unassigned</option>
              {crews.map((crew) => (
                <option key={crew.id} value={crew.id}>{crew.name}</option>
              ))}
            </select>
          </FormField>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-primary">People on this van</legend>
          <p className="text-xs leading-5 text-muted">
            These logins open this van on the phone. Each person has one home van. The crew above is unchanged by this list.
          </p>
          {!peopleLoaded ? (
            <p className="text-sm text-muted">People could not be loaded. Van details can still be saved.</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-muted">No people to assign yet.</p>
          ) : (
            <ul className="max-h-52 space-y-1 overflow-y-auto rounded-atlas-md border border-default p-2">
              {roster.map((person) => {
                const on = selected[person.id] === true;
                const locked = on && initialIds.has(person.id) && !canRemoveOperators;
                const elsewhere = homeVanName(person.id);
                return (
                  <li key={person.id} className="rounded-atlas-md px-1 py-1">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex min-h-11 min-w-0 items-center gap-2 text-sm text-primary">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked}
                          onChange={(event) => togglePerson(person.id, event.target.checked)}
                        />
                        <span className="truncate">
                          {person.name}
                          {person.role ? <span className="ml-2 text-xs text-muted">{ROLE_LABEL[person.role] ?? person.role}</span> : null}
                        </span>
                      </label>
                      {on ? (
                        <label className="flex min-h-11 shrink-0 items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={homes[person.id] === true}
                            onChange={(event) => setHomes((current) => ({ ...current, [person.id]: event.target.checked }))}
                          />
                          Home van
                        </label>
                      ) : null}
                    </div>
                    {on && elsewhere && homes[person.id] ? (
                      <p className="pb-1 pl-6 text-xs text-muted">
                        {person.name} is home on {elsewhere}. Saving moves their home van here.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {peopleLoaded && !canRemoveOperators && mine.length > 0 ? (
            <p className="text-xs text-muted">Only an owner can remove someone from a van.</p>
          ) : null}
        </fieldset>
        <FormField label="Notes (optional)" htmlFor="vehicle-notes">
          <textarea id="vehicle-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : vehicle ? "Save changes" : "Add van"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
