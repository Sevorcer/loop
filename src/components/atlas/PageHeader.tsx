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
      <CardHeader className="flex flex-col gap-3 p-4 sm:gap-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1 sm:space-y-2">
          <CardTitle className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
            {title}
          </CardTitle>

          {description ? (
            <CardDescription className="hidden max-w-2xl text-sm leading-relaxed sm:block sm:text-base">
              {description}
            </CardDescription>
          ) : null}
        </div>

        {actions ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {actions}
          </div>
        ) : null}
      </CardHeader>
    </Card>
  );
}
