"use client";

import { useState } from "react";
import { BellRing, Truck } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";

import { useJobs } from "../state/JobsProvider";

interface JobNotificationsCardProps {
  jobId: string;
}

function emailNote(email: { sent: boolean; reason?: string }): string | null {
  if (email.sent) return null;
  if (email.reason === "no_recipient") {
    return "No customer email on file, so nothing was sent.";
  }
  if (email.reason === "not_configured") {
    return "Email sending isn't set up yet, so nothing was sent.";
  }
  if (email.reason === "provider_error") {
    return "The email couldn't be sent (provider error).";
  }
  return null;
}

export function JobNotificationsCard({ jobId }: JobNotificationsCardProps) {
  const { getJobById, setJobNotifications, markJobEnRoute } = useJobs();
  const { role } = useCurrentRole();

  const job = getJobById(jobId);
  const enabled = job?.customerNotificationsEnabled === true;
  const enRouteAt = job?.enRouteAt ?? null;
  const isTech = role === "tech";

  const [pending, setPending] = useState<"toggle" | "enroute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleToggle() {
    setPending("toggle");
    setError(null);
    setSuccess(null);
    const result = await setJobNotifications(jobId, !enabled);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (enabled) {
      setSuccess("Customer notifications are off for this job.");
      return;
    }
    const note = emailNote(result.email);
    setSuccess(
      result.email.sent
        ? "Notifications on — the scheduled email was sent to the customer."
        : `Notifications on.${note ? ` ${note}` : ""}`,
    );
  }

  async function handleEnRoute() {
    setPending("enroute");
    setError(null);
    setSuccess(null);
    const result = await markJobEnRoute(jobId);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!enabled) {
      setSuccess("Marked on the way.");
      return;
    }
    const note = emailNote(result.email);
    setSuccess(
      result.email.sent
        ? "Marked on the way — the customer was emailed."
        : `Marked on the way.${note ? ` ${note}` : ""}`,
    );
  }

  const enRouteLabel = enRouteAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(enRouteAt))
    : null;

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
            <BellRing className="h-4 w-4 text-red-300" />
          </div>
          <h2 className="text-base font-semibold text-white">
            Customer Notifications
          </h2>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Off by default. When on, the customer is emailed when you turn
          this on (appointment scheduled), when the crew taps On The Way,
          and when the job is finished. Rescheduling never sends an email.
        </p>

        {isTech ? null : (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-medium text-white">
              {enabled ? "On" : "Off"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Customer notifications for this job"
              disabled={pending !== null}
              onClick={() => void handleToggle()}
              className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${
                enabled ? "bg-emerald-500/80" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
                  enabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        )}

        <div className="mt-4">
          {enRouteAt ? (
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <Truck className="h-4 w-4 text-slate-400" />
              Crew marked on the way
              {enRouteLabel ? ` at ${enRouteLabel}` : ""}.
            </p>
          ) : (
            <Button
              onClick={() => void handleEnRoute()}
              disabled={pending !== null}
              className="min-h-11 w-full gap-2 border border-white/10 bg-white/[0.04] text-white hover:bg-white/10 disabled:opacity-50 sm:w-auto"
            >
              <Truck className="h-4 w-4" />
              {pending === "enroute" ? "Marking…" : "On The Way"}
            </Button>
          )}
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {success}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
