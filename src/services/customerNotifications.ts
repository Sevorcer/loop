/**
 * Customer notifications (live-review #35, Collin's model, 2026-11-04).
 *
 * EMAIL ONLY, opt-in per job, OFF by default, and NEVER fired by
 * scheduling or rescheduling — jobs get moved around and the customer
 * must not hear about it. The three sends:
 *
 *  1. Scheduled — sent at the moment the office flips the job's
 *     "Customer notifications" toggle ON (not when the job is booked).
 *  2. On the way — sent when the crew taps "On The Way" (first tap
 *     only), while the toggle is on.
 *  3. Finished — sent when the job transitions to Completed, while
 *     the toggle is on.
 *
 * Sending is best-effort: a failed or unconfigured send never blocks
 * the underlying job action.
 */

import "server-only";

import { sendEmail, type EmailSendResult } from "@/lib/email";
import { companyTimeZone } from "@/lib/timezone";
import { getCustomerById } from "@/repositories/customers";
import { listContactsByCustomerId } from "@/repositories/customerContacts";
import {
  createJobActivity,
  getJobById,
  markJobEnRoute as repoMarkJobEnRoute,
  setJobNotificationsEnabled as repoSetNotificationsEnabled,
} from "@/repositories/jobs";
import type { Job } from "@/features/jobs/types/job";

export type CustomerEmailKind = "scheduled" | "on_the_way" | "finished";

export interface NotificationOutcome {
  job: Job;
  email: EmailSendResult;
}

interface MutationContext {
  actorId?: string;
  role?: string;
}

/** Primary contact's email, else any contact email, else the customer's. */
export async function resolveCustomerEmail(job: Job): Promise<string | null> {
  if (!job.customerId) return null;

  const contacts = await listContactsByCustomerId(job.customerId).catch(
    () => [],
  );
  const withEmail = contacts.filter((c) => c.email?.trim());
  const primary = withEmail.find((c) => c.isPrimary);
  if (primary) return primary.email.trim();
  if (withEmail.length > 0) return withEmail[0].email.trim();

  const customer = await getCustomerById(job.customerId).catch(() => null);
  return customer?.email?.trim() ? customer.email.trim() : null;
}

function formatWhen(job: Job): string | null {
  if (!job.scheduledStartAt) return null;
  const date = new Date(job.scheduledStartAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: companyTimeZone(),
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function composeCustomerEmail(
  job: Job,
  kind: CustomerEmailKind,
): { subject: string; text: string } {
  const when = formatWhen(job);
  const where = job.location?.trim();
  const lines: string[] = [];

  if (kind === "scheduled") {
    lines.push(
      `Hello ${job.customerName},`,
      "",
      "Your appointment with Legacy One Heating is scheduled" +
        (when ? ` for ${when}` : "") +
        ".",
    );
    if (where) lines.push(`Location: ${where}`);
    lines.push(
      "",
      "If you need to reschedule, just reply to this email or call us at (425) 374-7052.",
    );
  } else if (kind === "on_the_way") {
    lines.push(
      `Hello ${job.customerName},`,
      "",
      "Good news — your Legacy One Heating technician is on the way" +
        (where ? ` to ${where}` : "") +
        ".",
      "",
      "We'll see you shortly.",
    );
  } else {
    lines.push(
      `Hello ${job.customerName},`,
      "",
      "Your job with Legacy One Heating is complete. Thank you for having us out!",
      "",
      "If anything doesn't look right, reply to this email or call us at (425) 374-7052.",
    );
  }

  lines.push("", "— Legacy One Heating");

  const subject =
    kind === "scheduled"
      ? "Your Legacy One Heating appointment is scheduled"
      : kind === "on_the_way"
        ? "Your technician is on the way"
        : "Your job is complete — thank you!";

  return { subject, text: lines.join("\n") };
}

/** Resolve the recipient and send one of the three customer emails. */
export async function deliverCustomerEmail(
  job: Job,
  kind: CustomerEmailKind,
): Promise<EmailSendResult> {
  const to = await resolveCustomerEmail(job);
  if (!to) return { sent: false, reason: "no_recipient" };
  const { subject, text } = composeCustomerEmail(job, kind);
  return sendEmail({ to, subject, text });
}

/**
 * Flip the per-job opt-in. Turning it ON sends the Scheduled email at
 * that moment (Collin's rule); turning it off sends nothing.
 */
export async function setJobNotifications(
  id: string,
  enabled: boolean,
  context?: MutationContext,
): Promise<NotificationOutcome | null> {
  const updated = await repoSetNotificationsEnabled(id, enabled);
  if (!updated) return null;

  const job = await getJobById(id);
  if (!job) return null;

  await createJobActivity({
    jobId: id,
    actorId: context?.actorId,
    type: "status",
    title: enabled
      ? "Customer notifications turned on"
      : "Customer notifications turned off",
    description: enabled
      ? "The customer will be emailed about this job (scheduled, on the way, finished)."
      : "The customer will no longer be emailed about this job.",
  }).catch(() => undefined);

  if (!enabled) return { job, email: { sent: false } };
  const email = await deliverCustomerEmail(job, "scheduled");
  return { job, email };
}

/**
 * The "On The Way" step. Stamps en_route_at on the first tap only and,
 * when notifications are on, emails the customer exactly once.
 */
export async function markJobEnRoute(
  id: string,
  context?: MutationContext,
): Promise<(NotificationOutcome & { stamped: boolean }) | null> {
  const stamped = await repoMarkJobEnRoute(id);
  const job = await getJobById(id);
  if (!job) return null;

  if (!stamped) {
    return { job, email: { sent: false }, stamped: false };
  }

  await createJobActivity({
    jobId: id,
    actorId: context?.actorId,
    type: "status",
    title: "On the way",
    description: "The crew marked themselves on the way to this job.",
  }).catch(() => undefined);

  if (!job.customerNotificationsEnabled) {
    return { job, email: { sent: false }, stamped: true };
  }
  const email = await deliverCustomerEmail(job, "on_the_way");
  return { job, email, stamped: true };
}

/**
 * Completion hook — called by updateJobStatus after a job lands on
 * Completed. Best-effort by contract: never throws.
 */
export async function notifyJobCompleted(job: Job): Promise<void> {
  try {
    if (!job.customerNotificationsEnabled) return;
    await deliverCustomerEmail(job, "finished");
  } catch {
    // Email must never break job completion.
  }
}
