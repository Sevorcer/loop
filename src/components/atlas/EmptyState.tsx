import { type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
        {icon ? (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
            {icon}
          </div>
        ) : null}

        <h3 className="text-lg font-semibold">{title}</h3>

        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {action ? <div className="mt-6">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
