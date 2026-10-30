import type { JobActivity } from "../types/jobActivity";

export const JOB_PRICE_ACTIVITY_TYPE = "price" as const;
export const JOB_PRICE_REDACTED_DESCRIPTION = "The job price was updated.";

export type JobPriceChangeKind = "set" | "changed" | "cleared";

/** Timeline text names the person and the action. It never includes an amount. */
export function jobPriceActivityCopy(actorName: string, kind: JobPriceChangeKind): {
  title: string;
  description: string;
} {
  const who = actorName.trim() || "Someone";
  const title = "Job price updated";
  if (kind === "cleared") return { title, description: `${who} cleared the job price.` };
  if (kind === "set") return { title, description: `${who} set the job price.` };
  return { title, description: `${who} changed the job price.` };
}

const PRICE_AMOUNT = /\$|\d/;

/**
 * Price timeline text is safe to show. If a dollar amount is ever stored in
 * that text, replace the sentence so it cannot leak through the activity API.
 */
export function redactJobPriceActivity<T extends Pick<JobActivity, "type" | "description">>(
  items: readonly T[],
  canSeePrice = false,
): T[] {
  return items.map((item) => {
    if (item.type !== JOB_PRICE_ACTIVITY_TYPE) return item;
    const hasAmount = PRICE_AMOUNT.test(item.description);
    if (hasAmount && canSeePrice) return { ...item, description: JOB_PRICE_REDACTED_DESCRIPTION };
    if (hasAmount) return { ...item, description: JOB_PRICE_REDACTED_DESCRIPTION };
    return item;
  });
}
