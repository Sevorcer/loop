"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { VEHICLE_STATUSES, type Vehicle } from "../types/ledger";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

export interface CrewOption {
  id: string;
  name: string;
}

interface VehicleDialogProps {
  /** Omit to add a new van; pass a vehicle to edit it. */
  vehicle?: Vehicle;
  crews: CrewOption[];
}

const STATUS_LABELS: Record<Vehicle["status"], string> = {
  active: "Active",
  out_of_service: "Out of service",
  retired: "Retired",
};

export function VehicleDialog({ vehicle, crews }: VehicleDialogProps) {
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
      {open ? <VehicleForm vehicle={vehicle} crews={crews} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VehicleForm({ vehicle, crews, onClose }: VehicleDialogProps & { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [name, setName] = useState(vehicle?.name ?? "");
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [vin, setVin] = useState(vehicle?.vin ?? "");
  const [status, setStatus] = useState<Vehicle["status"]>(vehicle?.status ?? "active");
  const [crewId, setCrewId] = useState(vehicle?.crewId ?? "");
  const [notes, setNotes] = useState(vehicle?.notes ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the van a name, like “Van 2”.");
    const body = {
      name: name.trim(),
      plate: plate.trim() || null,
      vin: vin.trim() || null,
      status,
      crewId: crewId || null,
      notes: notes.trim() || null,
    };
    const result = vehicle
      ? await run(`/api/inventory/vehicles/${vehicle.id}`, "PATCH", body)
      : await run("/api/inventory/vehicles", "POST", body);
    if (result.ok) onClose();
  }

  return (
    <DialogShell
      title={vehicle ? `Edit ${vehicle.name}` : "Add van"}
      description={vehicle ? undefined : "Adding a van also creates its stock location."}
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
