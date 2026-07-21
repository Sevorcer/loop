"use client";

/**
 * AdminFieldWrapper — labeled field container for admin forms.
 *
 * Provides consistent label, optional required marker, and field layout.
 * Wraps the field input with any associated error message slot.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AdminFieldWrapperProps {
  /** Label text displayed above the input. */
  label: string;
  /** HTML `for` attribute value matching the input's `id`. */
  htmlFor?: string;
  /** When true, appends a required asterisk to the label. */
  required?: boolean;
  /** Optional hint text displayed below the label. */
  hint?: string;
  /** The form control(s) to render inside the wrapper. */
  children: ReactNode;
  /** Additional class names for the outer wrapper element. */
  className?: string;
}

export function AdminFieldWrapper({
  label,
  htmlFor,
  required,
  hint,
  children,
  className,
}: AdminFieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-200"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-red-400" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}
