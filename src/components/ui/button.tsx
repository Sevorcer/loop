import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex",
    "items-center",
    "justify-center",
    "gap-2",
    "rounded-lg",
    "border",
    "font-medium",
    "whitespace-nowrap",
    "transition-atlas",
    "outline-none",
    "cursor-pointer",
    "select-none",
    "disabled:pointer-events-none",
    "disabled:opacity-50",
    "focus-visible:ring-2",
    "focus-visible:ring-[var(--primary)]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "btn-primary",
        secondary: "btn-secondary",
        outline: "btn-outline",
        ghost: "btn-ghost",
        destructive: "btn-destructive",
        link: "btn-link border-transparent shadow-none h-auto p-0",
      },

      size: {
        xs: "h-6 px-2 text-xs",
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },

    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants>;

function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({
          variant,
          size,
          className,
        })
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };