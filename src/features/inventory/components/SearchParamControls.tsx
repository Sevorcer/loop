"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { fieldClass } from "./formStyles";

function useReplaceParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (param: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(param, value);
    else next.delete(param);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
}

interface SearchParamInputProps {
  param: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
}

/** Type-ahead search: debounces into a URL search param so the server screen re-renders filtered. */
export function SearchParamInput({ param, label, placeholder, initialValue = "" }: SearchParamInputProps) {
  const replaceParam = useReplaceParam();
  const [value, setValue] = useState(initialValue);
  const lastSent = useRef(initialValue);

  useEffect(() => {
    if (value === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = value;
      replaceParam(param, value.trim() || null);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replaceParam is recreated each render by design
  }, [value, param]);

  return (
    <div className="min-w-0 flex-1 sm:max-w-xs">
      <label htmlFor={`search-${param}`} className="sr-only">{label}</label>
      <input
        id={`search-${param}`}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder ?? label}
        autoComplete="off"
        className={fieldClass}
      />
    </div>
  );
}

interface SearchParamSelectProps {
  param: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  /** Value that means "no filter" and clears the param. */
  clearValue?: string;
}

export function SearchParamSelect({ param, label, value, options, clearValue }: SearchParamSelectProps) {
  const replaceParam = useReplaceParam();
  const id = `select-${param}`;
  return (
    <div className="min-w-0 sm:w-56">
      <label htmlFor={id} className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => replaceParam(param, event.target.value === clearValue ? null : event.target.value)}
        className={fieldClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
