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

        <div className="flex items-start justify-between">

          <div className="space-y-1">

            <p className="text-muted text-xs font-semibold uppercase tracking-[0.18em]">
              {title}
            </p>

            <h3 className="text-primary text-4xl font-bold tracking-tight">
              {value}
            </h3>

          </div>

          {icon ? (
            <div className="text-muted">
              {icon}
            </div>
          ) : null}

        </div>

        {(description || trend) && (
          <div className="flex items-center justify-between text-sm">

            {description ? (
              <span className="text-muted">
                {description}
              </span>
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