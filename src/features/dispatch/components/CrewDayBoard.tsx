"use client";

import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { DispatchSnapshot, ScheduleBlock } from "../types/dispatch";
import { detectCrewConflicts } from "../utils/conflictDetection";
import { formatScheduleTime, getLocalTodayISO } from "../utils/dispatchUtils";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function shiftDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function groupBlocksByCrew(blocks: ScheduleBlock[]): Map<string, ScheduleBlock[]> {
  const groups = new Map<string, ScheduleBlock[]>();
  for (const block of blocks) {
    const existing = groups.get(block.crewName) ?? [];
    existing.push(block);
    groups.set(block.crewName, existing);
  }
  // Sort within each crew group by start time
  for (const [, crewBlocks] of groups) {
    crewBlocks.sort((a, b) =>
      a.scheduledStartTime.localeCompare(b.scheduledStartTime),
    );
  }
  return groups;
}

// ------------------------------------------------------------------
// CrewDayBoard
// ------------------------------------------------------------------

interface CrewDayBoardProps {
  initialSnapshot: DispatchSnapshot;
}

export function CrewDayBoard({ initialSnapshot }: CrewDayBoardProps) {
  const today = getLocalTodayISO();
  const [selectedDate, setSelectedDate] = useState(today);

  const blocksForDate = initialSnapshot.scheduleBlocks.filter(
    (b) => b.scheduledDate === selectedDate,
  );

  const conflictIds = detectCrewConflicts(blocksForDate);
  const hasConflicts = conflictIds.size > 0;
  const crewGroups = groupBlocksByCrew(blocksForDate);
  const isToday = selectedDate === today;

  return (
    <div className="space-y-4">
      {/* ── Date Navigation ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-white/20 hover:text-white"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-1 items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-white">
            {formatDayLabel(selectedDate)}
          </span>
          {isToday && (
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-300">
              Today
            </span>
          )}
          {hasConflicts && (
            <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              {(() => {
                const count = conflictIds.size >> 1;
                return `${count} conflict${count !== 1 ? "s" : ""}`;
              })()}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-white/20 hover:text-white"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {!isToday && (
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-white"
          >
            Back to Today
          </button>
        )}
      </div>

      {/* ── Crew Groups ── */}
      {crewGroups.size === 0 ? (
        <SurfaceCard>
          <div className="p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm text-slate-500">
              No schedule blocks for {isToday ? "today" : formatDayLabel(selectedDate)}.
            </p>
          </div>
        </SurfaceCard>
      ) : (
        <div className="space-y-3">
          {[...crewGroups.entries()].map(([crewName, blocks]) => {
            const crewConflicts = blocks.filter((b) => conflictIds.has(b.id));
            return (
              <CrewGroup
                key={crewName}
                crewName={crewName}
                blocks={blocks}
                conflictIds={conflictIds}
                hasConflict={crewConflicts.length > 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// CrewGroup — one crew's jobs for the day
// ------------------------------------------------------------------

interface CrewGroupProps {
  crewName: string;
  blocks: ScheduleBlock[];
  conflictIds: Set<string>;
  hasConflict: boolean;
}

function CrewGroup({ crewName, blocks, conflictIds, hasConflict }: CrewGroupProps) {
  return (
    <SurfaceCard
      className={
        hasConflict ? "border-amber-500/20" : undefined
      }
    >
      {/* Crew header */}
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05]">
          <Users className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <span className="text-sm font-semibold text-white">{crewName}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
          {blocks.length} {blocks.length === 1 ? "job" : "jobs"}
        </span>
        {hasConflict && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Schedule conflict
          </span>
        )}
      </div>

      {/* Block list */}
      <div className="divide-y divide-white/5">
        {blocks.map((block) => (
          <ScheduleBlockRow
            key={block.id}
            block={block}
            isConflicting={conflictIds.has(block.id)}
          />
        ))}
      </div>
    </SurfaceCard>
  );
}

// ------------------------------------------------------------------
// ScheduleBlockRow — a single job within a crew's day
// ------------------------------------------------------------------

interface ScheduleBlockRowProps {
  block: ScheduleBlock;
  isConflicting: boolean;
}

function ScheduleBlockRow({ block, isConflicting }: ScheduleBlockRowProps) {
  const isActive = block.dispatchStatus === "in_progress";

  return (
    <div
      className={`flex items-start gap-4 px-4 py-3 transition-colors hover:bg-white/[0.02] ${
        isConflicting ? "bg-amber-500/5" : ""
      }`}
    >
      {/* Status indicator */}
      <div className="mt-0.5 flex-shrink-0">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            isActive ? "bg-violet-400" : "bg-blue-400"
          }`}
        />
      </div>

      {/* Time */}
      <div className="flex w-24 flex-shrink-0 items-center gap-1 text-xs text-slate-400">
        <Clock className="h-3 w-3 text-slate-600" />
        <span>
          {formatScheduleTime(block.scheduledStartTime)}
          <span className="text-slate-600"> – </span>
          {formatScheduleTime(block.scheduledEndTime)}
        </span>
      </div>

      {/* Job info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-500">{block.jobType}</span>
          {isConflicting && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              Overlap
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-medium text-white">
          {block.customerName}
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3" />
          {block.propertyName}
        </p>
      </div>

      {/* Duration + job link */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <span className="text-xs text-slate-500">
          {block.estimatedDurationHours}h
        </span>
        {block.jobId && (
          <Link
            href={ROUTE_BUILDERS.JOB_DETAIL(block.jobId)}
            className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-blue-300"
            title="View job detail"
          >
            <ExternalLink className="h-3 w-3" />
            Job
          </Link>
        )}
      </div>
    </div>
  );
}
