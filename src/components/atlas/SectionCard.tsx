import { type ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function SectionCard({
  title,
  description,
  children,
  actions,
}: SectionCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {title || description || actions ? (
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="space-y-0.5">
            {title ? (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </div>
  );
}
