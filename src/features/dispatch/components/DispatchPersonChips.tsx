"use client";

import { useState } from "react";
import { AlertTriangle, UserPlus, X } from "lucide-react";

import type { DispatchAssignee, DispatchPerson, DispatchTimeOffWindow } from "../types/dispatch";
import { isLegacyAssignee, teamLabelForPeople } from "../utils/dispatchPeople";

const DRAG_TYPE = "application/x-loop-person";

interface DispatchPersonChipsProps {
  planId: string;
  people: DispatchAssignee[];
  directory: DispatchPerson[];
  timeOff: DispatchTimeOffWindow[];
  canAssign: boolean;
  onAddPerson: (personId: string) => void;
  onRemovePerson: (personId: string) => void;
  onReplacePerson: (personId: string, nextPersonId: string) => void;
  onMovePerson: (fromPlanId: string, personId: string) => void;
}

export function DispatchPersonChips({
  planId,
  people,
  directory,
  timeOff,
  canAssign,
  onAddPerson,
  onRemovePerson,
  onReplacePerson,
  onMovePerson,
}: DispatchPersonChipsProps) {
  const [dropActive, setDropActive] = useState(false);
  const label = teamLabelForPeople(people);
  const assignedIds = new Set(people.filter((person) => !isLegacyAssignee(person)).map((person) => person.id));
  const available = directory.filter((person) => !assignedIds.has(person.id));

  return (
    <div
      className={`mt-4 space-y-2 rounded-xl border border-dashed px-3 py-3 ${
        dropActive ? "border-blue-400/60 bg-blue-500/10" : "border-white/10"
      }`}
      onDragOver={(event) => {
        if (!canAssign) return;
        event.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => {
        setDropActive(false);
        if (!canAssign) return;
        const raw = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");
        if (!raw) return;
        event.preventDefault();
        try {
          const payload = JSON.parse(raw) as { planId?: string; personId?: string };
          if (!payload.planId || !payload.personId || payload.planId === planId) return;
          onMovePerson(payload.planId, payload.personId);
        } catch {
          // A bad drag payload is ignored.
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">
          {label ? label : "No one assigned"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {people.map((person) => {
          const legacy = isLegacyAssignee(person);
          const off = timeOff.find((entry) => entry.userId === person.id);
          return (
            <span
              key={person.id}
              draggable={canAssign && !legacy}
              onDragStart={(event) => {
                if (!canAssign || legacy) return;
                const payload = JSON.stringify({ planId, personId: person.id });
                event.dataTransfer.setData(DRAG_TYPE, payload);
                event.dataTransfer.setData("text/plain", payload);
                event.dataTransfer.effectAllowed = "move";
              }}
              className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                off
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-100"
                  : legacy
                    ? "border-white/10 bg-white/[0.03] text-slate-400"
                    : "border-white/15 bg-white/[0.06] text-slate-100"
              }`}
            >
              <span className="truncate">{person.name}</span>
              {off ? (
                <span className="inline-flex items-center gap-1 text-yellow-200" title={off.reason}>
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  Off
                </span>
              ) : null}
              {legacy ? <span className="text-[10px] uppercase tracking-wide">Previous crew</span> : null}
              {canAssign && !legacy ? (
                <>
                  <label className="sr-only" htmlFor={`replace-${planId}-${person.id}`}>
                    Replace {person.name}
                  </label>
                  <select
                    id={`replace-${planId}-${person.id}`}
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) {
                        onReplacePerson(person.id, event.target.value);
                        event.target.value = "";
                      }
                    }}
                    className="max-w-[9rem] rounded-md border border-white/10 bg-slate-950 px-1 py-0.5 text-[11px] text-slate-300"
                    aria-label={`Replace ${person.name}`}
                  >
                    <option value="">Replace with…</option>
                    {directory
                      .filter((candidate) => candidate.id !== person.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemovePerson(person.id)}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label={`Remove ${person.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : null}
            </span>
          );
        })}

        {canAssign ? (
          <span className="inline-flex items-center gap-1">
            <UserPlus className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            <label className="sr-only" htmlFor={`add-${planId}`}>
              Add a person
            </label>
            <select
              id={`add-${planId}`}
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  onAddPerson(event.target.value);
                  event.target.value = "";
                }
              }}
              className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none focus:border-emerald-500/40"
              aria-label="Add a person"
            >
              <option value="">Add a person…</option>
              {available.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </span>
        ) : null}
      </div>

      {timeOff.length > 0 ? (
        <p className="text-xs text-yellow-300" role="status">
          Off during this job:{" "}
          {timeOff.map((entry) => `${entry.personName} (${entry.reason})`).join("; ")}.
        </p>
      ) : null}
      {people.some((person) => isLegacyAssignee(person)) ? (
        <p className="text-xs text-slate-500">
          Names marked previous crew are still on the old crew list and are not a user account, so they stay visible.
        </p>
      ) : null}
    </div>
  );
}
