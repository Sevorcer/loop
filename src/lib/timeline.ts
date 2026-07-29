export type TimelineEventSource =
  | "customer"
  | "property"
  | "job"
  | "job_activity"
  | "dispatch_event"
  | "installed_system";

export interface TimelineEventItem {
  id: string;
  title: string;
  description?: string;
  occurredAt: string;
  source: TimelineEventSource;
  actor?: string;
  href?: string;
  hrefLabel?: string;
  relatedPropertyId?: string;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function timelineTimestampToEpochMs(value: string): number {
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function compareTimelineEventsDesc(
  left: Pick<TimelineEventItem, "id" | "occurredAt">,
  right: Pick<TimelineEventItem, "id" | "occurredAt">,
): number {
  const timestampDelta =
    timelineTimestampToEpochMs(right.occurredAt) - timelineTimestampToEpochMs(left.occurredAt);

  if (timestampDelta !== 0) {
    return timestampDelta;
  }

  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

export function formatTimelineTimestamp(value: string): string {
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(parsed));
}
