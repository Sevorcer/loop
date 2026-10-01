"use client";

import { useEffect, useRef, useState } from "react";

export interface RecordOption {
  id: string;
  name: string;
}

interface RecordComboboxProps {
  label: string;
  options: RecordOption[];
  value: string;
  onSelect: (name: string, id: string | null) => void;
  onCreateNew: (name: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Fix C(1): type-ahead combobox for linking a customer or property record.
 * Type to filter the existing records, pick one to link it. When the typed
 * text matches no record, an explicit "+ Create new: <typed name>" choice
 * is shown — creating a record is always an explicit user action, never a
 * silent consequence of a typo.
 */
export function RecordCombobox({
  label,
  options,
  value,
  onSelect,
  onCreateNew,
  placeholder,
  required,
  disabled,
}: RecordComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the visible text in sync when the value changes externally
  // (e.g. form reset or a programmatic selection).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter((option) =>
        option.name.toLowerCase().includes(normalizedQuery),
      )
    : options;
  const exactMatch = options.some(
    (option) => option.name.toLowerCase() === normalizedQuery,
  );
  const showCreateNew = normalizedQuery.length > 0 && !exactMatch;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? `Type to search ${label.toLowerCase()}...`}
        required={required}
        disabled={disabled}
        aria-label={label}
        autoComplete="off"
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-white/10 bg-slate-900 shadow-xl">
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onSelect(option.name, option.id);
                setQuery(option.name);
                setOpen(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-white/5"
            >
              {option.name}
            </button>
          ))}
          {showCreateNew && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(query.trim());
                setOpen(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-emerald-300 hover:bg-white/5"
            >
              + Create new: {query.trim()}
            </button>
          )}
          {filtered.length === 0 && !showCreateNew && (
            <div className="px-4 py-2.5 text-sm text-slate-500">
              No matches
            </div>
          )}
        </div>
      )}
    </div>
  );
}
