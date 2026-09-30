"use client";

/**
 * DateTimePicker — F11 fix.
 *
 * The native <input type="datetime-local"> renders its AM/PM segment as an
 * unlabeled spinbutton (shows numeric codes 0/1/2 in some browsers), which made
 * scheduling times painful to enter. This component replaces it with explicit,
 * labeled controls: a date field plus hour / minute / AM–PM selects.
 *
 * The value contract matches datetime-local exactly ("YYYY-MM-DDTHH:mm" or ""),
 * so it plugs into the existing scheduling pipeline (schedulingTime.ts:
 * parseDatetimeLocalInput / deriveScheduledForDate) with no changes downstream.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface DateTimeParts {
  date: string;
  hour12: string;
  minute: string;
  period: string;
}

const EMPTY_PARTS: DateTimeParts = { date: "", hour12: "", minute: "", period: "" };

/** Parse a "YYYY-MM-DDTHH:mm" value into picker parts. */
export function parseDateTimeLocal(value: string): DateTimeParts {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return { ...EMPTY_PARTS };
  const [, date, hh, mm] = match;
  const hour24 = Number(hh);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    date,
    hour12: String(hour12),
    minute: String(Number(mm)).padStart(2, "0"),
    period,
  };
}

/** Combine picker parts back into a "YYYY-MM-DDTHH:mm" value. Returns "" unless complete. */
export function formatDateTimeLocal(parts: DateTimeParts): string {
  const { date, hour12, minute, period } = parts;
  if (!date || !hour12 || !minute || !period) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  let hour24 = Number(hour12) % 12;
  if (period === "PM") hour24 += 12;
  const mm = Number(minute);
  if (!Number.isInteger(mm) || mm < 0 || mm > 59) return "";
  return `${date}T${String(hour24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTE_STEP_OPTIONS = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

/**
 * Apply one part change, preserving partial input.
 *
 * The picker is filled one control at a time, so the parts the user already
 * chose must stick while the rest are still empty. Returns the next parts plus
 * the combined "YYYY-MM-DDTHH:mm" value ("" until every part is present).
 */
export function applyDateTimePartChange(
  parts: DateTimeParts,
  part: keyof DateTimeParts,
  partValue: string,
): { next: DateTimeParts; combined: string } {
  const next = { ...parts, [part]: partValue };
  return { next, combined: formatDateTimeLocal(next) };
}

interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  ariaLabel?: string;
  invalid?: boolean;
}

const controlClass = (invalid: boolean) =>
  `rounded-2xl border px-3 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40 ${
    invalid ? "border-red-500/50 bg-red-500/5" : "border-white/10 bg-white/[0.03]"
  }`;

export function DateTimePicker({
  id,
  value,
  onChange,
  required,
  ariaLabel,
  invalid = false,
}: DateTimePickerProps) {
  // Local part state: the user fills the controls one at a time, and each
  // choice must stick while the rest are still empty. Deriving the parts from
  // `value` on every render would wipe partial input, because onChange only
  // emits "" until every part is present.
  const [parts, setParts] = useState<DateTimeParts>(() => parseDateTimeLocal(value));
  const lastEmittedRef = useRef<string>(formatDateTimeLocal(parseDateTimeLocal(value)));

  // Resync when the parent changes the value externally (form reset, loaded record).
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setParts(parseDateTimeLocal(value));
      lastEmittedRef.current = value;
    }
  }, [value]);

  const minuteOptions = useMemo(() => {
    if (parts.minute && !MINUTE_STEP_OPTIONS.includes(parts.minute)) {
      return [...MINUTE_STEP_OPTIONS, parts.minute].sort();
    }
    return MINUTE_STEP_OPTIONS;
  }, [parts.minute]);

  function handlePartChange(part: keyof DateTimeParts, partValue: string) {
    const { next, combined } = applyDateTimePartChange(parts, part, partValue);
    setParts(next);
    lastEmittedRef.current = combined;
    onChange(combined);
  }

  const label = ariaLabel ?? "Date and time";

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2" role="group" aria-label={label}>
      <input
        id={id}
        type="date"
        aria-label={`${label} — date`}
        value={parts.date}
        onChange={(e) => handlePartChange("date", e.target.value)}
        required={required}
        className={`${controlClass(invalid)} w-full min-w-0 bg-slate-950`}
      />
      <select
        aria-label={`${label} — hour`}
        value={parts.hour12}
        onChange={(e) => handlePartChange("hour12", e.target.value)}
        required={required}
        className={`${controlClass(invalid)} bg-slate-950`}
      >
        <option value="" disabled>Hr</option>
        {HOUR_OPTIONS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} — minute`}
        value={parts.minute}
        onChange={(e) => handlePartChange("minute", e.target.value)}
        required={required}
        className={`${controlClass(invalid)} bg-slate-950`}
      >
        <option value="" disabled>Min</option>
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} — AM or PM`}
        value={parts.period}
        onChange={(e) => handlePartChange("period", e.target.value)}
        required={required}
        className={`${controlClass(invalid)} bg-slate-950 font-medium`}
      >
        <option value="" disabled>—</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
