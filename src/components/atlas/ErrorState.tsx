import { type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * ErrorState — Atlas-tier error display.
 *
 * Used when a data-loading operation fails and the content region cannot be
 * rendered. Provides a consistent visual treatment across all features.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>

        <h3 className="text-lg font-semibold">{title}</h3>

        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {action ? <div className="mt-6">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
