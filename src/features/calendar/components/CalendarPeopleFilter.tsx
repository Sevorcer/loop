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
    <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">People</p>
        {active ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-white/15 px-3 text-xs text-foreground hover:bg-white/10 md:min-h-9"
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

      <div className="relative min-w-0">
        <div
          className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter calendar by person"
        >
          <button
            type="button"
            aria-pressed={!active}
            onClick={() => onChange([])}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-sm md:min-h-10 ${
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
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-3 text-left text-sm md:min-h-10 md:max-w-full md:shrink md:whitespace-normal ${
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden"
        />
      </div>

      <div className="min-w-0 space-y-2 border-t border-white/10 pt-3" data-calendar-shared-groups="">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Shared groups</p>
        <p className="text-sm text-muted">
          {groups.length === 0
            ? "No shared groups yet. Select people and save a group. Everyone in the office sees it."
            : "These groups are shared with the office and stay after a reload."}
        </p>
        <div className="relative min-w-0">
          <div
            className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Shared calendar groups"
          >
            {groups.map((group) => (
              <span
                key={group.id}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/10 md:min-h-10 md:shrink"
              >
                <button
                  type="button"
                  onClick={() => onApplyGroup(group.personIds)}
                  className="inline-flex min-h-11 items-center whitespace-nowrap px-3 text-sm text-foreground md:min-h-10 md:whitespace-normal"
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
                  className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-foreground md:min-h-10"
                  aria-label={`Edit group ${group.name}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteGroup(group.id)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-foreground md:min-h-0 md:min-w-0 md:px-2"
                  aria-label={`Remove group ${group.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {selectedIds.length > 0 && !naming ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setGroupName(label === "All" ? "" : label);
                  setNaming(true);
                }}
                className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-dashed border-white/15 px-3 text-sm text-muted hover:text-foreground md:min-h-10"
              >
                Save group
              </button>
            ) : null}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden"
          />
        </div>
        {naming ? (
          <form
            className="flex min-w-0 flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = groupName.trim();
              if (!name || selectedIds.length === 0) return;
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
              className="min-h-11 w-full min-w-0 max-w-full flex-1 rounded-xl border border-white/10 bg-transparent px-3 text-sm text-foreground md:min-h-10 md:min-w-[10rem]"
            />
            <button type="submit" className="min-h-11 shrink-0 rounded-full border border-white/15 px-3 text-sm md:min-h-10">
              Save
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
