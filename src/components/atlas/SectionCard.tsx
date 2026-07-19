import { type ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
}: SectionCardProps) {
  return (
    <Card className="hover-lift">
      <CardHeader className="flex flex-col gap-3 p-4 sm:gap-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-0.5 sm:space-y-1">
          <CardTitle className="text-base sm:text-lg lg:text-xl">{title}</CardTitle>

          {description && (
            <CardDescription className="hidden text-sm leading-relaxed sm:block">
              {description}
            </CardDescription>
          )}
        </div>

        {actions && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {actions}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  );
}
