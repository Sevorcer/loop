"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

export interface RecordOption {
  id: string;
  name: string;
}

interface RecordComboboxProps {
  label: string;
  options: RecordOption[];
  value: string;
  onSelect: (name: string, id: string | null) => void;
  onCreateNew: (name: string) => void | Promise<void>;
  required?: boolean;
}

type Row =
  | { kind: "option"; option: RecordOption }
  | { kind: "create"; name: string };

export function RecordCombobox({
  label,
  options,
  value,
  onSelect,
  onCreateNew,
  required,
}: RecordComboboxProps) {
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const trimmed = query.trim();

  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, trimmed]);

  const exactMatch = useMemo(
    () => options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase()),
    [options, trimmed]
  );

  const showCreate = trimmed.length > 0 && !exactMatch;

  const rows: Row[] = useMemo(() => {
    const list: Row[] = filtered.map((option) => ({ kind: "option", option }));
    if (showCreate) list.push({ kind: "create", name: trimmed });
    return list;
  }, [filtered, showCreate, trimmed]);

  const choose = (option: RecordOption) => {
    setQuery(option.name);
    setOpen(false);
    setHighlight(0);
    onSelect(option.name, option.id);
  };

  const create = async () => {
    if (!trimmed) return;
    setQuery(trimmed);
    setOpen(false);
    setHighlight(0);
    await onCreateNew(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (!row) return;
      if (row.kind === "option") choose(row.option);
      else void create();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      <input
        type="text"
        value={query}
        required={required}
        placeholder={`Select ${label.toLowerCase()}`}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
      />
      {open && rows.length > 0 && (
        <ul className="absolute z-30 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-900 py-1 shadow-xl">
          {rows.map((row, i) =>
            row.kind === "option" ? (
              <li key={row.option.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(row.option)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`block w-full px-4 py-2.5 text-left text-sm text-white ${
                    i === highlight ? "bg-white/10" : ""
                  }`}
                >
                  {row.option.name}
                </button>
              </li>
            ) : (
              <li key="__create">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void create()}
                  onMouseEnter={() => setHighlight(i)}
                  className={`block w-full px-4 py-2.5 text-left text-sm font-medium text-emerald-300 ${
                    i === highlight ? "bg-white/10" : ""
                  }`}
                >
                  + Create new: {row.name}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
