<<<<<<< HEAD
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
=======
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex",
    "items-center",
    "justify-center",
    "rounded-full",
    "border",
    "px-3",
    "py-1",
    "text-xs",
    "font-semibold",
    "tracking-wide",
    "transition-atlas",
  ].join(" "),
  {
    variants: {
      variant: {
        success: "status-success",
        warning: "status-warning",
        danger: "status-danger",
        info: "status-info",
        neutral: "status-neutral",
      },
    },

    defaultVariants: {
      variant: "neutral",
    },
  }
);

interface StatusBadgeProps
  extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({
  children,
  variant,
  className,
}: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        badgeVariants({
          variant,
        }),
        className
      )}
>>>>>>> origin/main
    >
      {children}
    </span>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> origin/main
