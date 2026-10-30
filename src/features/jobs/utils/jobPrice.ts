import type { JobActivity } from "../types/jobActivity";
import { formatCentsAsUsd } from "@/lib/money";

export const JOB_PRICE_ACTIVITY_TYPE = "price" as const;
export const JOB_PRICE_REDACTED_DESCRIPTION = "The job price was updated.";

export function jobPriceActivityCopy(input: {
  previousCents: number | null;
  nextCents: number | null;
  actorName: string;
}): { title: string; description: string } {
  const who = input.actorName.trim() || "Someone";
  const title = "Job price updated";
  if (input.nextCents == null) {
    const was = input.previousCents == null ? "" : ` It was ${formatCentsAsUsd(input.previousCents)}.`;
    return { title, description: `${who} cleared the job price.${was}` };
  }
  if (input.previousCents == null) {
    return { title, description: `${who} set the job price to ${formatCentsAsUsd(input.nextCents)}.` };
  }
  return {
    title,
    description: `${who} changed the job price from ${formatCentsAsUsd(input.previousCents)} to ${formatCentsAsUsd(input.nextCents)}.`,
  };
}

/** Hide dollar amounts from roles that cannot read job revenue. */
export function redactJobPriceActivity<T extends Pick<JobActivity, "type" | "description">>(
  items: readonly T[],
  canSeePrice: boolean,
): T[] {
  if (canSeePrice) return [...items];
  return items.map((item) =>
    item.type === JOB_PRICE_ACTIVITY_TYPE
      ? { ...item, description: JOB_PRICE_REDACTED_DESCRIPTION }
      : item,
  );
}
