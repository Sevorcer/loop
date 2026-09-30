import {
  CalendarClock,
  ClipboardList,
  FileCheck2,
  FileImage,
  FilePenLine,
  FileText,
  User,
  Wrench,
} from "lucide-react";

import { EmptyState } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";

import type { JobActivity } from "../types/jobActivity";
import { sortJobActivity } from "../utils/jobWorkspace";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

// Raw database IDs sometimes land in the actor field; never show those to users.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDisplayableActor(actorId: string): boolean {
  return !UUID_PATTERN.test(actorId);
}

function getActivityIcon(type: JobActivity["type"]) {
  switch (type) {
    case "created":
      return <ClipboardList className="h-4 w-4 text-red-300" />;
    case "scheduled":
      return <CalendarClock className="h-4 w-4 text-blue-300" />;
    case "edited":
      return <FilePenLine className="h-4 w-4 text-indigo-300" />;
    case "assigned":
      return <User className="h-4 w-4 text-slate-200" />;
    case "status":
      return <Wrench className="h-4 w-4 text-amber-300" />;
    case "note":
      return <FileText className="h-4 w-4 text-slate-300" />;
    case "qa":
      return <FileCheck2 className="h-4 w-4 text-emerald-300" />;
    case "file":
      return <FileImage className="h-4 w-4 text-blue-300" />;
    default:
      return <ClipboardList className="h-4 w-4 text-red-300" />;
  }
}

export function JobTimeline({ activity }: { activity: JobActivity[] }) {
  const items = sortJobActivity(activity);

  return (
    <SurfaceCard>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-white">Activity Timeline</h2>
        <p className="mt-1 text-sm text-slate-400">
          Follow recent scheduling, assignment, and field updates for this job. Most recent events appear first.
        </p>

        <div className="mt-6 space-y-6">
          {items.length === 0 ? (
            <EmptyState
              title="No job history yet"
              description="Scheduling, assignment, and note activity will appear here once the team starts working this job."
              icon={<ClipboardList className="h-5 w-5" />}
              className="border-white/10 bg-white/[0.02]"
            />
          ) : (
            items.map((item, index) => (
              <div key={item.id} className="relative pl-12">
                {index !== items.length - 1 ? (
                  <div className="absolute left-[19px] top-10 h-[calc(100%+8px)] w-px bg-white/10" />
                ) : null}

                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  {getActivityIcon(item.type)}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.description}
                      </p>
                      {item.actorId && isDisplayableActor(item.actorId) ? (
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          Actor: {item.actorId}
                        </p>
                      ) : null}
                    </div>

                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {formatTimestamp(item.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}