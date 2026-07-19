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

      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="space-y-1">

          <CardTitle className="text-xl">
            {title}
          </CardTitle>

          {description && (
            <CardDescription>
              {description}
            </CardDescription>
          )}

        </div>

        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}

      </CardHeader>

      <CardContent>
        {children}
      </CardContent>

    </Card>
  );
}
