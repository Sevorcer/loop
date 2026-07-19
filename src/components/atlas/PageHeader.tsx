import { type ReactNode } from "react";

<<<<<<< HEAD
=======
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

>>>>>>> origin/main
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

<<<<<<< HEAD
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
=======
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
>>>>>>> origin/main
