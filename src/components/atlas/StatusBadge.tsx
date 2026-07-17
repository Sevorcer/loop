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
    >
      {children}
    </span>
  );
}