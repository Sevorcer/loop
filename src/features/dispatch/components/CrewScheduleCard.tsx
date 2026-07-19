"use client";

import { Clock, MapPin, Users } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import type { ScheduleBlock } from "../types/dispatch";
import {
  formatScheduleTime,
  getDispatchStatusLabel,
} from "../utils/dispatchUtils";

interface CrewScheduleCardProps {
  block: ScheduleBlock;
}

export function CrewScheduleCard({ block }: CrewScheduleCardProps) {
  const isActive = block.dispatchStatus === "in_progress";
  const isScheduled = block.dispatchStatus === "scheduled";

  const borderColor = isActive
    ? "border-l-violet-500"
    : isScheduled
      ? "border-l-blue-500"
      : "border-l-slate-700";

  return (
    <SurfaceCard
      className={`border-l-4 transition-all duration-200 hover:border-white/20 ${borderColor}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">
                {block.jobType}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  isActive
                    ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-300"
                }`}
              >
                {getDispatchStatusLabel(block.dispatchStatus)}
              </span>
            </div>

            <p className="mt-1.5 text-sm font-semibold text-white">
              {block.customerName}
            </p>
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="h-3 w-3" />
              {block.propertyName}
            </p>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="flex items-center gap-1 text-xs font-medium text-slate-300">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              {formatScheduleTime(block.scheduledStartTime)} –{" "}
              {formatScheduleTime(block.scheduledEndTime)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {block.estimatedDurationHours}h
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-3">
          <Users className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">{block.crewName}</span>
        </div>
      </div>
    </SurfaceCard>
  );
}
