"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Dropdown that shows at most ~4 options at a time and scrolls for the
 * rest (live-review #30, Collin: "no type of permit stat should show
 * more than 4"). A native <select> popup's height can't be capped —
 * especially on mobile, where it opens as a long list — so the permit
 * status pickers use this small custom listbox instead.
 */
export interface CappedSelectOption {
  value: string;
  label: string;
}

interface CappedSelectProps {
  value: string;
  options: CappedSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** Classes for the trigger button (sizing/typography per call site). */
  triggerClassName?: string;
  /** Keep clicks from reaching a card underneath (board cards). */
  stopPropagation?: boolean;
}

export function CappedSelect({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  triggerClassName = "",
  stopPropagation = false,
}: CappedSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const guard = (e: MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
  };

  return (
    <div ref={rootRef} className="relative" onClick={guard}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2 ${triggerClassName}`}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-36 overflow-y-auto rounded-lg border border-border bg-surface-elevated py-1 shadow-xl"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${
                opt.value === value ? "text-primary" : "text-muted"
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value ? (
                <Check size={14} className="shrink-0" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
