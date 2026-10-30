import type { ReactNode } from "react";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
};

export default function SurfaceCard({
  children,
  className = "",
}: SurfaceCardProps) {
  return (
    <div
      className={[
        "min-w-0 max-w-full rounded-3xl border border-default bg-surface text-foreground shadow-atlas-md",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}