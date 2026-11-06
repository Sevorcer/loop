/** Diff for the people assigned to one van. One home van per person is applied by the service, not here. */

export interface OperatorAssignment {
  userId: string;
  isHome: boolean;
}

export interface OperatorChangePlan {
  add: OperatorAssignment[];
  update: OperatorAssignment[];
  remove: string[];
  /** People who should be home on this van, so any other home row has to drop first. */
  clearHomeUserIds: string[];
  problems: string[];
}

export function planOperatorChanges(
  current: readonly OperatorAssignment[],
  desired: readonly OperatorAssignment[],
): OperatorChangePlan {
  const problems: string[] = [];
  const seen = new Set<string>();
  const cleanDesired: OperatorAssignment[] = [];

  for (const row of desired) {
    const userId = row.userId.trim();
    if (!userId) {
      problems.push("Choose a person.");
      continue;
    }
    if (seen.has(userId)) {
      problems.push("Each person can only be listed once.");
      continue;
    }
    seen.add(userId);
    cleanDesired.push({ userId, isHome: row.isHome === true });
  }

  const currentByUser = new Map(current.map((row) => [row.userId, row]));
  const desiredByUser = new Map(cleanDesired.map((row) => [row.userId, row]));
  const add: OperatorAssignment[] = [];
  const update: OperatorAssignment[] = [];
  const remove: string[] = [];
  const clearHomeUserIds: string[] = [];

  for (const row of cleanDesired) {
    const existing = currentByUser.get(row.userId);
    if (!existing) add.push(row);
    else if (existing.isHome !== row.isHome) update.push(row);
    if (row.isHome) clearHomeUserIds.push(row.userId);
  }
  for (const row of current) {
    if (!desiredByUser.has(row.userId)) remove.push(row.userId);
  }

  return { add, update, remove, clearHomeUserIds, problems };
}
