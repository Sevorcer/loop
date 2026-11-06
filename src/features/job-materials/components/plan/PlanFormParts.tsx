import type { ReactNode } from "react";

import { planHintClass, planLabelClass } from "./planStyles";

export function PlanField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={planLabelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className={planHintClass}>{hint}</p> : null}
    </div>
  );
}

export function PlanError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="status-danger rounded-atlas-md px-3 py-2 text-sm">
      {message}
    </p>
  );
}
