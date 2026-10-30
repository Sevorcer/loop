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

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
              className={`flex w-full min-w-0 flex-col items-stretch gap-2 rounded-2xl border px-3 py-2 text-xs sm:inline-flex sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:items-center sm:rounded-full sm:px-2 sm:py-1 ${
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
                    className="min-h-11 w-full min-w-0 max-w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-300 sm:min-h-0 sm:w-auto sm:max-w-[9rem] sm:px-1 sm:py-0.5 sm:text-[11px]"
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
                    className="inline-flex min-h-11 min-w-11 items-center justify-center self-start rounded-full text-slate-400 hover:bg-white/10 hover:text-white sm:min-h-0 sm:min-w-0 sm:self-auto sm:p-0.5"
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
          <span className="flex w-full min-w-0 items-center gap-1 sm:w-auto">
            <UserPlus className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
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
              className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none focus:border-emerald-500/40 sm:min-h-0 sm:w-auto"
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
