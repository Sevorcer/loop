import { ReactNode } from "react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: string | number;

  icon?: ReactNode;

  description?: string;

  trend?: {
    value: string;
    positive?: boolean;
  };
}

export function KPICard({
  title,
  value,
  icon,
  description,
  trend,
}: KPICardProps) {
  return (
    <Card className="hover-lift">
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-muted text-xs font-semibold uppercase tracking-[0.18em]">
              {title}
            </p>

            <h3 className="text-primary text-3xl font-bold tracking-tight sm:text-4xl">
              {value}
            </h3>
          </div>

          {icon ? (
            <div className="text-muted shrink-0">{icon}</div>
          ) : null}
        </div>

        {(description || trend) && (
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            {description ? (
              <span className="text-muted">{description}</span>
            ) : (
              <span />
            )}

            {trend ? (
              <span
                className={
                  trend.positive
                    ? "font-medium text-green-400"
                    : "font-medium text-red-400"
                }
              >
                {trend.value}
              </span>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}