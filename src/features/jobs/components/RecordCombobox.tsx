"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  filterRecordOptions,
  formatMissingPropertyDraft,
  missingPropertyDraftFields,
  type PropertyDraft,
} from "@/features/jobs/utils/propertyPicker";

export interface RecordOption {
  id: string;
  name: string;
  detail?: string;
}

interface RecordComboboxProps {
  id?: string;
  label: string;
  /** Hide the built-in label when the parent already labels this field. */
  showLabel?: boolean;
  options: RecordOption[];
  value: string;
  onSelect: (name: string, id: string | null) => void;
  onCreateNew: (name: string) => void | Promise<void>;
  onCreateAddress?: (draft: PropertyDraft) => Promise<void> | void;
  onQueryChange?: (text: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Property picker: search the address and add a property with a street and city. */
  createWithAddress?: boolean;
  placeholder?: string;
}

type Row =
  | { kind: "option"; option: RecordOption }
  | { kind: "create"; name: string };

export function RecordCombobox({
  id,
  label,
  showLabel = true,
  options,
  value,
  onSelect,
  onCreateNew,
  onCreateAddress,
  onQueryChange,
  required,
  disabled,
  createWithAddress = false,
  placeholder,
}: RecordComboboxProps) {
  const [query, setQuery] = useState(value ?? "");
  const [syncedValue, setSyncedValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [addressDraft, setAddressDraft] = useState<PropertyDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value ?? "");
  }

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const trimmed = query.trim();

  const filtered = useMemo(() => filterRecordOptions(options, trimmed), [options, trimmed]);

  const exactMatch = useMemo(
    () => options.some((option) => option.name.toLowerCase() === trimmed.toLowerCase()),
    [options, trimmed],
  );

  const showCreate = createWithAddress || (trimmed.length > 0 && !exactMatch);

  const rows: Row[] = useMemo(() => {
    const list: Row[] = filtered.map((option) => ({ kind: "option", option }));
    if (showCreate) list.push({ kind: "create", name: trimmed });
    return list;
  }, [filtered, showCreate, trimmed]);

  const choose = (option: RecordOption) => {
    setQuery(option.name);
    setOpen(false);
    setHighlight(0);
    setAddressDraft(null);
    onSelect(option.name, option.id);
  };

  const create = async () => {
    if (createWithAddress) {
      setAddressDraft({ name: trimmed, address: "", city: "" });
      setDraftError(null);
      setOpen(false);
      return;
    }
    if (!trimmed) return;
    setQuery(trimmed);
    setOpen(false);
    setHighlight(0);
    await onCreateNew(trimmed);
  };

  async function saveAddressDraft() {
    if (!addressDraft || !onCreateAddress) return;
    const missing = missingPropertyDraftFields(addressDraft);
    const message = formatMissingPropertyDraft(missing);
    if (message) {
      setDraftError(message);
      return;
    }
    try {
      setSavingDraft(true);
      setDraftError(null);
      await onCreateAddress({
        name: addressDraft.name.trim(),
        address: addressDraft.address.trim(),
        city: addressDraft.city.trim(),
      });
      setQuery(addressDraft.name.trim());
      setAddressDraft(null);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Couldn't add the property.");
    } finally {
      setSavingDraft(false);
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(rows.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const row = rows[highlight];
      if (!row) return;
      if (row.kind === "option") choose(row.option);
      else void create();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const createLabel = createWithAddress
    ? trimmed
      ? `Add a new property: ${trimmed}`
      : "Add a new property"
    : `+ Create new: ${trimmed}`;

  return (
    <div ref={rootRef} className="relative min-w-0">
      {showLabel ? (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/80">
          {label}
          {required ? <span className="text-red-400"> *</span> : null}
        </label>
      ) : null}
      <input
        id={id}
        type="text"
        value={query}
        aria-required={required || undefined}
        disabled={disabled}
        placeholder={placeholder ?? `Select ${label.toLowerCase()}`}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlight(0);
          onQueryChange?.(event.target.value);
        }}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
      />
      {open && !disabled && rows.length > 0 && (
        <ul className="absolute z-30 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-900 py-1 shadow-xl">
          {rows.map((row, index) =>
            row.kind === "option" ? (
              <li key={row.option.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(row.option)}
                  onMouseEnter={() => setHighlight(index)}
                  className={`block w-full px-4 py-2.5 text-left text-sm text-white ${
                    index === highlight ? "bg-white/10" : ""
                  }`}
                >
                  <span className="block">{row.option.name}</span>
                  {row.option.detail ? (
                    <span className="block text-xs text-slate-400">{row.option.detail}</span>
                  ) : null}
                </button>
              </li>
            ) : (
              <li key="__create">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void create()}
                  onMouseEnter={() => setHighlight(index)}
                  className={`block w-full px-4 py-2.5 text-left text-sm font-medium text-emerald-300 ${
                    index === highlight ? "bg-white/10" : ""
                  }`}
                >
                  {createLabel}
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {addressDraft ? (
        <div
          className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveAddressDraft();
            }
          }}
        >
          <p className="text-sm font-medium text-slate-200">New property</p>
          <input
            value={addressDraft.name}
            onChange={(event) =>
              setAddressDraft((current) => (current ? { ...current, name: event.target.value } : current))
            }
            placeholder="Property name"
            aria-label="Property name"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200 outline-none"
          />
          <input
            value={addressDraft.address}
            onChange={(event) =>
              setAddressDraft((current) =>
                current ? { ...current, address: event.target.value } : current,
              )
            }
            placeholder="Street address"
            aria-label="Street address"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200 outline-none"
          />
          <input
            value={addressDraft.city}
            onChange={(event) =>
              setAddressDraft((current) => (current ? { ...current, city: event.target.value } : current))
            }
            placeholder="City"
            aria-label="City"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200 outline-none"
          />
          {draftError ? (
            <p className="text-sm text-red-300" role="alert">
              {draftError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-[44px] flex-1 rounded-xl bg-white/10 text-sm text-white"
              onClick={() => void saveAddressDraft()}
              disabled={savingDraft}
            >
              {savingDraft ? "Saving..." : "Save property"}
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-xl px-3 text-sm text-slate-300"
              onClick={() => {
                setAddressDraft(null);
                setDraftError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
