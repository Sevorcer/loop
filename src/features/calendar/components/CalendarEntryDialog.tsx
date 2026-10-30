"use client";

import { useEffect, useState } from "react";

import { DateTimePicker } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import { companyCalendarDate, utcIsoToCompanyDateTimeLocal } from "@/lib/timezone";

import {
  TIME_OFF_REASONS,
  canManageCalendarEntries,
  type CalendarPerson,
  type CalendarTaskEntry,
  type TimeOffEntry,
} from "../types/calendarEntries";

export type CalendarEditor =
  | { mode: "choose"; date: string }
  | { mode: "time_off"; date: string; entry?: TimeOffEntry }
  | { mode: "task"; date: string; entry?: CalendarTaskEntry };

export function CalendarEntryDialog({
  editor,
  role,
  team,
  onClose,
  onSaved,
  onPickKind,
}: {
  editor: CalendarEditor;
  role: string | null;
  team: CalendarPerson[];
  onClose: () => void;
  onSaved: () => void;
  onPickKind: (kind: "time_off" | "task", date: string) => void;
}) {
  const office = canManageCalendarEntries(role);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-entry-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-surface p-5 text-foreground shadow-atlas-lg"
        onClick={(event) => event.stopPropagation()}
      >
        {editor.mode === "choose" ? (
          <ChooseKind date={editor.date} onClose={onClose} onPick={onPickKind} />
        ) : editor.mode === "time_off" ? (
          <TimeOffForm editor={editor} office={office} team={team} onClose={onClose} onSaved={onSaved} />
        ) : (
          <TaskForm editor={editor} office={office} role={role} team={team} onClose={onClose} onSaved={onSaved} />
        )}
      </div>
    </div>
  );
}

function ChooseKind({
  date,
  onClose,
  onPick,
}: {
  date: string;
  onClose: () => void;
  onPick: (kind: "time_off" | "task", date: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 id="calendar-entry-title" className="text-lg font-semibold">Add to {date}</h2>
      <p className="text-sm text-muted">Choose what you are adding. Jobs are still created from the Jobs page.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <ChoiceButton label="Time off" detail="Someone is out" onClick={() => onPick("time_off", date)} />
        <ChoiceButton label="Task" detail="A reminder that is not a job" onClick={() => onPick("task", date)} />
      </div>
      <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
    </div>
  );
}

function ChoiceButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.06]"
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-1 block text-xs text-muted">{detail}</span>
    </button>
  );
}

function TimeOffForm({
  editor,
  office,
  team,
  onClose,
  onSaved,
}: {
  editor: Extract<CalendarEditor, { mode: "time_off" }>;
  office: boolean;
  team: CalendarPerson[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editor.entry;
  const knownReason = TIME_OFF_REASONS.find((reason) => reason === existing?.reason);
  const [userId, setUserId] = useState(existing?.userId ?? team[0]?.id ?? "");
  const [allDay, setAllDay] = useState(existing?.allDay ?? true);
  const [start, setStart] = useState(initialStart(existing, editor.date));
  const [end, setEnd] = useState(initialEnd(existing, editor.date));
  const [reasonChoice, setReasonChoice] = useState(existing ? (knownReason ?? "other") : TIME_OFF_REASONS[0]);
  const [customReason, setCustomReason] = useState(knownReason || !existing ? "" : existing.reason);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reason = reasonChoice === "other" ? customReason : reasonChoice;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { userId, allDay, start, end, reason, note };
      if (existing) await requestJson(`/api/calendar/time-off/${existing.id}`, { method: "PATCH", body });
      else await requestJson("/api/calendar/time-off", { method: "POST", body });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save time off.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson(`/api/calendar/time-off/${existing.id}`, { method: "DELETE" });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not delete time off.");
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (office) void save();
      }}
    >
      <h2 id="calendar-entry-title" className="text-lg font-semibold">
        {existing ? "Time off" : "Add time off"}
      </h2>
      {!office ? (
        <p className="text-sm text-muted">You can view this time off. The office can change it.</p>
      ) : null}
      <label className="block space-y-1 text-sm">
        <span>Who</span>
        <select
          value={userId}
          disabled={!office}
          onChange={(event) => setUserId(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
        >
          {team.map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
          {existing && !team.some((person) => person.id === existing.userId) ? (
            <option value={existing.userId}>{existing.personName}</option>
          ) : null}
        </select>
      </label>
      <WhenFields allDay={allDay} setAllDay={setAllDay} start={start} end={end} setStart={setStart} setEnd={setEnd} disabled={!office} />
      <label className="block space-y-1 text-sm">
        <span>Reason</span>
        <select
          value={reasonChoice}
          disabled={!office}
          onChange={(event) => setReasonChoice(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
        >
          {TIME_OFF_REASONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
          <option value="other">Other</option>
        </select>
      </label>
      {reasonChoice === "other" ? (
        <input
          value={customReason}
          disabled={!office}
          onChange={(event) => setCustomReason(event.target.value)}
          placeholder="Reason"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
        />
      ) : null}
      <label className="block space-y-1 text-sm">
        <span>Note (optional)</span>
        <textarea
          value={note}
          disabled={!office}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {office ? (
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        ) : null}
        {office && existing ? (
          <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>Delete</Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </form>
  );
}

function TaskForm({
  editor,
  office,
  role,
  team,
  onClose,
  onSaved,
}: {
  editor: Extract<CalendarEditor, { mode: "task" }>;
  office: boolean;
  role: string | null;
  team: CalendarPerson[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editor.entry;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [allDay, setAllDay] = useState(existing?.allDay ?? false);
  const [start, setStart] = useState(initialStart(existing, editor.date));
  const [end, setEnd] = useState(initialEnd(existing, editor.date));
  const [assignEveryone, setAssignEveryone] = useState(existing?.assignEveryone ?? false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(existing?.assigneeIds ?? []);
  const [jobNumber, setJobNumber] = useState(existing?.jobNumber ?? "");
  const [customerName, setCustomerName] = useState(existing?.customerName ?? "");
  const [done, setDone] = useState(Boolean(existing?.doneAt));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title,
        description,
        allDay,
        start,
        end,
        assignEveryone,
        assigneeIds,
        jobNumber,
        customerName,
        done,
      };
      if (existing) await requestJson(`/api/calendar/tasks/${existing.id}`, { method: "PATCH", body });
      else await requestJson("/api/calendar/tasks", { method: "POST", body });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the task.");
    } finally {
      setSaving(false);
    }
  }

  async function markDone(next: boolean) {
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson(`/api/calendar/tasks/${existing.id}`, { method: "PATCH", body: { done: next } });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update the task.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setSaving(true);
    try {
      await requestJson(`/api/calendar/tasks/${existing.id}`, { method: "DELETE" });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not delete the task.");
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (office) void save();
      }}
    >
      <h2 id="calendar-entry-title" className="text-lg font-semibold">{existing ? "Task" : "Add task"}</h2>
      <label className="block space-y-1 text-sm">
        <span>Title</span>
        <input value={title} disabled={!office} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Description (optional)</span>
        <textarea value={description} disabled={!office} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" />
      </label>
      <WhenFields allDay={allDay} setAllDay={setAllDay} start={start} end={end} setStart={setStart} setEnd={setEnd} disabled={!office} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={assignEveryone} disabled={!office} onChange={(event) => setAssignEveryone(event.target.checked)} />
        Assigned to everyone
      </label>
      {!assignEveryone ? (
        <fieldset className="space-y-2" disabled={!office}>
          <legend className="text-sm">Assigned to</legend>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 px-3 py-2">
            {team.map((person) => (
              <label key={person.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(person.id)}
                  onChange={(event) => {
                    setAssigneeIds((current) =>
                      event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id),
                    );
                  }}
                />
                {person.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="block space-y-1 text-sm">
        <span>Job number (optional)</span>
        <input value={jobNumber} disabled={!office} onChange={(event) => setJobNumber(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Customer (optional)</span>
        <input value={customerName} disabled={!office} onChange={(event) => setCustomerName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" />
      </label>
      {office ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={done} onChange={(event) => setDone(event.target.checked)} />
          Done
        </label>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {office ? <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button> : null}
        {!office && existing && role === "tech" ? (
          <Button type="button" disabled={saving} onClick={() => void markDone(!done)}>
            {done ? "Mark not done" : "Mark done"}
          </Button>
        ) : null}
        {office && existing ? (
          <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>Delete</Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </form>
  );
}

function WhenFields({
  allDay,
  setAllDay,
  start,
  end,
  setStart,
  setEnd,
  disabled,
}: {
  allDay: boolean;
  setAllDay: (value: boolean) => void;
  start: string;
  end: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allDay}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.checked;
            setAllDay(next);
            setStart(next ? start.slice(0, 10) : start.length === 10 ? `${start}T08:00` : start);
            setEnd(next ? end.slice(0, 10) : end.length === 10 ? `${end}T17:00` : end);
          }}
        />
        All day
      </label>
      {allDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span>Start date</span>
            <input type="date" value={start.slice(0, 10)} disabled={disabled} onChange={(event) => setStart(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" />
          </label>
          <label className="block space-y-1 text-sm">
            <span>End date</span>
            <input type="date" value={end.slice(0, 10)} disabled={disabled} onChange={(event) => setEnd(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" />
          </label>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="space-y-1">
            <span className="text-sm">Start</span>
            <DateTimePicker value={start} onChange={setStart} disabled={disabled} ariaLabel="Start" />
          </div>
          <div className="space-y-1">
            <span className="text-sm">End</span>
            <DateTimePicker value={end} onChange={setEnd} disabled={disabled} ariaLabel="End" />
          </div>
        </div>
      )}
    </div>
  );
}

function initialStart(entry: { startsAt: string; allDay: boolean } | undefined, date: string): string {
  if (!entry) return date;
  if (entry.allDay) return companyCalendarDate(entry.startsAt) ?? date;
  return utcIsoToCompanyDateTimeLocal(entry.startsAt);
}

function initialEnd(entry: { endsAt: string; allDay: boolean } | undefined, date: string): string {
  if (!entry) return date;
  if (entry.allDay) return companyCalendarDate(entry.endsAt) ?? date;
  return utcIsoToCompanyDateTimeLocal(entry.endsAt);
}
