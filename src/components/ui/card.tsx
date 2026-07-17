import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-surface border border-default rounded-atlas-3xl shadow-atlas-md transition-atlas overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-2 px-6 py-6 sm:px-7",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "text-primary text-lg font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn(
        "text-muted text-sm leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-6 pb-6 sm:px-7",
        className
      )}
      {...props}
    />
  );
}

function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center border-t border-default px-6 py-5 sm:px-7",
        className
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};