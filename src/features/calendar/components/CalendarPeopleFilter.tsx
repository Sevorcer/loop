"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { CalendarPerson } from "../types/calendarEntries";
import {
  calendarPeopleFilterLabel,
  type CalendarQuickGroup,
} from "../utils/calendarPeopleFilter";

interface CalendarPeopleFilterProps {
  people: CalendarPerson[];
  selectedIds: string[];
  groups: CalendarQuickGroup[];
  onChange: (personIds: string[]) => void;
  onSaveGroup: (name: string, personIds: string[], groupId?: string) => void;
  onApplyGroup: (personIds: string[]) => void;
  onDeleteGroup: (groupId: string) => void;
}

export function CalendarPeopleFilter({
  people,
  selectedIds,
  groups,
  onChange,
  onSaveGroup,
  onApplyGroup,
  onDeleteGroup,
}: CalendarPeopleFilterProps) {
  const [groupName, setGroupName] = useState("");
  const [naming, setNaming] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const selected = new Set(selectedIds);
  const active = selectedIds.length > 0;
  const label = calendarPeopleFilterLabel(people, selectedIds);

  function toggle(personId: string) {
    const next = selected.has(personId)
      ? selectedIds.filter((id) => id !== personId)
      : [...selectedIds, personId];
    onChange(next);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">People</p>
        {active ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/15 px-3 text-xs text-foreground hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>

      {active ? (
        <p className="text-sm text-foreground" role="status">
          Showing {label}
        </p>
      ) : (
        <p className="text-sm text-muted">Showing everyone.</p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter calendar by person">
        <button
          type="button"
          aria-pressed={!active}
          onClick={() => onChange([])}
          className={`min-h-10 rounded-full border px-3 text-sm ${
            !active ? "border-white/30 bg-white/10 text-foreground" : "border-white/10 text-muted"
          }`}
        >
          All
        </button>
        {people.map((person) => {
          const pressed = selected.has(person.id);
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(person.id)}
              className={`min-h-10 max-w-full rounded-full border px-3 text-left text-sm ${
                pressed
                  ? "border-white/30 bg-white/10 text-foreground"
                  : "border-white/10 text-muted hover:text-foreground"
              }`}
            >
              {person.name}
            </button>
          );
        })}
      </div>

      {groups.length > 0 || selectedIds.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          {groups.map((group) => (
            <span
              key={group.id}
              className="inline-flex min-h-10 items-center rounded-full border border-white/10"
            >
              <button
                type="button"
                onClick={() => onApplyGroup(group.personIds)}
                className="px-3 text-sm text-foreground"
              >
                {group.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyGroup(group.personIds);
                  setEditingId(group.id);
                  setGroupName(group.name);
                  setNaming(true);
                }}
                className="px-2 text-sm text-muted hover:text-foreground"
                aria-label={`Edit group ${group.name}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteGroup(group.id)}
                className="px-2 text-muted hover:text-foreground"
                aria-label={`Remove group ${group.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {selectedIds.length > 1 && !naming ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setGroupName(label);
                setNaming(true);
              }}
              className="min-h-10 rounded-full border border-dashed border-white/15 px-3 text-sm text-muted hover:text-foreground"
            >
              Save group
            </button>
          ) : null}
          {naming ? (
            <form
              className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const name = groupName.trim();
                if (!name) return;
                onSaveGroup(name, selectedIds, editingId ?? undefined);
                setNaming(false);
                setEditingId(null);
                setGroupName("");
              }}
            >
              <label className="sr-only" htmlFor="calendar-group-name">
                Group name
              </label>
              <input
                id="calendar-group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="min-h-10 min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-transparent px-3 text-sm text-foreground"
              />
              <button type="submit" className="min-h-10 rounded-full border border-white/15 px-3 text-sm">
                Save
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
