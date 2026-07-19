import type { ReactNode } from "react";

import SurfaceCard from "@/components/layout/SurfaceCard";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

type StatusBadgeVariant = "neutral" | "success" | "warning" | "destructive";

const badgeStyles: Record<StatusBadgeVariant, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  destructive: "border-red-200 bg-red-50 text-red-700",
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <SurfaceCard className="overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      <div className="p-6">{children}</div>
    </SurfaceCard>
  );
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <SurfaceCard>
      <div className="flex flex-col items-start gap-4 p-8 text-left">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {action}
      </div>
    </SurfaceCard>
  );
}

export function StatusBadge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: StatusBadgeVariant;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        badgeStyles[variant],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
