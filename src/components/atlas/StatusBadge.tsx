import { type ReactNode } from "react";

type StatusBadgeVariant = "default" | "destructive" | "warning" | "neutral" | "success" | "info";

interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<StatusBadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  destructive: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-green-100 text-green-700",
  info: "bg-blue-100 text-blue-700",
};

export function StatusBadge({
  variant = "default",
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
