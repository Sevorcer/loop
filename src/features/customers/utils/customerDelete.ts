/**
 * Plain message when a customer cannot be deleted because jobs or properties
 * still point at them. Cancelled jobs count: the database link is what blocks
 * the delete, not whether the work is still open.
 */
export function customerDeleteBlockedMessage(
  jobCount: number,
  propertyCount: number,
): string | null {
  const jobs = Math.max(0, Math.floor(jobCount));
  const properties = Math.max(0, Math.floor(propertyCount));
  if (jobs === 0 && properties === 0) return null;

  const parts: string[] = [];
  if (jobs > 0) parts.push(`${jobs} ${jobs === 1 ? "job" : "jobs"}`);
  if (properties > 0) {
    parts.push(`${properties} ${properties === 1 ? "property" : "properties"}`);
  }
  const list = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];
  return `This customer still has ${list}. Remove or reassign them first.`;
}
