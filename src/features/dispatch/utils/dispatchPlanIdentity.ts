/**
 * One dispatch plan per job. Extra plans (a second UTC day for a same-day
 * Pacific appointment, or one plan per day of a range) were all drawn on the
 * job's company day and looked like duplicate cards.
 */

export interface DispatchPlanIdentity {
  id: string;
  targetDate?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

/**
 * Keep the plan already aimed at the job's company day. Otherwise keep the
 * most recently updated plan. Ties break on created time, then id, so the
 * choice is stable.
 */
export function chooseDispatchPlanToKeep<T extends DispatchPlanIdentity>(
  plans: T[],
  companyDate: string | null,
): T | null {
  if (plans.length === 0) return null;

  return [...plans].sort((left, right) => {
    const leftMatch = companyDate && left.targetDate === companyDate ? 0 : 1;
    const rightMatch = companyDate && right.targetDate === companyDate ? 0 : 1;
    if (leftMatch !== rightMatch) return leftMatch - rightMatch;

    const updated = (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
    if (updated !== 0) return updated;

    const created = (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
    if (created !== 0) return created;

    return right.id.localeCompare(left.id);
  })[0];
}
