import Link from "next/link";

import { EmptyState, PageHeader, StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PORTAL_ROUTES, ROUTES } from "@/lib/routes";
import type { PortalProject } from "../types/portalTypes";

const STATUS_LABELS = {
  not_started: "Not started",
  in_progress: "In progress",
  inspection_pending: "Inspection pending",
  completed: "Completed",
  on_hold: "On hold",
  cancelled: "Cancelled",
} as const;

const STATUS_VARIANTS = {
  not_started: "neutral",
  in_progress: "info",
  inspection_pending: "warning",
  completed: "success",
  on_hold: "warning",
  cancelled: "danger",
} as const;

interface PortalHomeScreenProps {
  projects: PortalProject[];
}

export function PortalHomeScreen({ projects }: PortalHomeScreenProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6">
      <PageHeader
        title="Project Portal"
        description="Choose a project to view progress, documents, photos, and contact details in one place."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects are available yet"
          description="Projects will appear here once your contractor shares access. If you were expecting a project, contact your contractor or return to the main workspace."
          action={
            <Button render={<Link href={ROUTES.HOME} />} variant="outline">
              Return Home
            </Button>
          }
        />
      ) : (
        <section
          aria-label="Available projects"
          className="grid gap-4 md:grid-cols-2"
        >
          {projects.map((project) => (
            <Card key={project.id} className="h-full">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.address}</CardDescription>
                  </div>
                  <StatusBadge variant={STATUS_VARIANTS[project.status]}>
                    {STATUS_LABELS[project.status]}
                  </StatusBadge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Completion
                    </dt>
                    <dd className="text-sm text-primary">
                      {project.completionPct}% complete
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Project manager
                    </dt>
                    <dd className="text-sm text-primary">
                      {project.projectManager}
                    </dd>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Next milestone
                    </dt>
                    <dd className="text-sm text-primary">
                      {project.nextMilestone ?? "No milestone scheduled"}
                    </dd>
                  </div>
                </dl>
              </CardContent>

              <CardFooter>
                <Button render={<Link href={PORTAL_ROUTES.PROJECT(project.id)} />}>
                  Open Project
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
