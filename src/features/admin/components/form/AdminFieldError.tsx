"use client";

/**
 * AdminFieldError — inline field-level error message.
 *
 * Renders one or more validation error messages directly below a form field.
 * Renders nothing when `errors` is undefined, null, or an empty array.
 */

import { AlertCircle } from "lucide-react";

interface AdminFieldErrorProps {
  /** The field's HTML id — used to build the aria-describedby target id. */
  fieldId?: string;
  /**
   * One or more error messages. When empty/undefined the component renders
   * nothing, making it safe to always render without conditional wrapping.
   */
  errors?: string | string[];
}

export function AdminFieldError({ fieldId, errors }: AdminFieldErrorProps) {
  const messages = normalizeErrors(errors);
  if (messages.length === 0) return null;

  const id = fieldId ? `${fieldId}-error` : undefined;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className="flex items-start gap-1.5 text-xs text-red-400"
    >
      <AlertCircle
        size={12}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span>{messages.join(" ")}</span>
    </div>
  );
}

function normalizeErrors(errors: string | string[] | undefined): string[] {
  if (!errors) return [];
  if (typeof errors === "string") return errors.length > 0 ? [errors] : [];
  return errors.filter(Boolean);
}
