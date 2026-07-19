import { type ReactNode } from "react";

<<<<<<< HEAD
interface SectionCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
=======
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
>>>>>>> origin/main
}

export function SectionCard({
  title,
  description,
<<<<<<< HEAD
  children,
  actions,
}: SectionCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {title || description || actions ? (
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="space-y-0.5">
            {title ? (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </div>
  );
}
=======
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
>>>>>>> origin/main
