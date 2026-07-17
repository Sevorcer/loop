import { type ReactNode } from "react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-3xl font-bold tracking-tight">
            {title}
          </CardTitle>

          {description ? (
            <CardDescription className="max-w-2xl text-base leading-relaxed">
              {description}
            </CardDescription>
          ) : null}
        </div>

        {actions ? (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        ) : null}
      </CardHeader>
    </Card>
  );
}