"use client";

/**
 * AdminFormActions — submit/cancel action row for admin forms.
 *
 * Renders a standardized bottom action bar with:
 *   - A primary submit button (with loading + disabled state handling)
 *   - An optional cancel link/button
 *
 * The submit button shows a spinner and "Saving…" label while `isLoading`
 * is true and is fully disabled when either `isLoading` or `disabled` is set.
 */

import type { ReactNode } from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminFormActionsProps {
  /** Label shown on the submit button in the idle state. Defaults to "Save". */
  submitLabel?: string;
  /** Label shown on the submit button while submitting. Defaults to "Saving…". */
  loadingLabel?: string;
  /** When true, shows a spinner and disables the submit button. */
  isLoading?: boolean;
  /** When true, disables the submit button regardless of loading state. */
  disabled?: boolean;
  /** Optional cancel action. Accepts a button, link, or any ReactNode. */
  cancelAction?: ReactNode;
  /** Additional class names for the outer wrapper. */
  className?: string;
}

export function AdminFormActions({
  submitLabel = "Save",
  loadingLabel = "Saving…",
  isLoading = false,
  disabled = false,
  cancelAction,
  className,
}: AdminFormActionsProps) {
  const isDisabled = isLoading || disabled;

  return (
    <div
      className={cn(
        "flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end",
        className
      )}
    >
      {cancelAction ? <div className="w-full sm:w-auto">{cancelAction}</div> : null}
      <Button
        type="submit"
        disabled={isDisabled}
        className="w-full sm:w-auto"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="mr-2 animate-spin" aria-hidden="true" />
            {loadingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}
