import "server-only";

import type { Customer } from "@/features/customers/types/customer";
import type { CustomerJobItem, CustomerPropertyItem } from "@/features/customers/types/customerDetails";
import type { Job } from "@/features/jobs/types/job";
import type { InstalledSystem } from "@/features/installed-systems/types/installedSystem";
import type { Property } from "@/features/properties/types/property";
import type { DispatchEvent, DispatchPlan } from "@/features/dispatch/types/dispatch";
import { ROUTE_BUILDERS } from "@/lib/routes";
import type { TimelineEventItem } from "@/lib/timeline";
import { listActivityByJobIds } from "@/repositories/jobs";
import { loadDispatchSnapshot } from "@/services/dispatch";

function getDispatchEventTitle(type: string) {
  switch (type) {
    case "job_scheduled":
      return "Dispatch scheduled job";
    case "crew_assigned":
      return "Crew assignment updated";
    case "schedule_changed":
      return "Dispatch schedule changed";
    case "crew_dispatched":
      return "Crew dispatched";
    case "job_rescheduled":
      return "Job rescheduled";
    case "crew_delayed":
      return "Crew delay logged";
    default:
      return "Dispatch event recorded";
  }
}

async function buildJobEventFeed(jobIds: string[]) {
  if (jobIds.length === 0) {
    return { activity: [], dispatchEvents: [] };
  }

  const [activity, dispatchSnapshot] = await Promise.all([
    listActivityByJobIds(jobIds),
    loadDispatchSnapshot(),
  ]);

  const jobIdSet = new Set(jobIds);
  const planById = new Map(dispatchSnapshot.plans.map((plan) => [plan.id, plan]));

  const dispatchEvents: Array<{ event: DispatchEvent; plan: DispatchPlan }> = [];

  for (const event of dispatchSnapshot.events) {
    const plan = planById.get(event.dispatchPlanId);
    if (!plan) continue;
    if (!jobIdSet.has(plan.jobId)) continue;
    dispatchEvents.push({ event, plan });
  }

  return { activity, dispatchEvents };
}

function buildJobScheduledEvents(jobs: Array<Pick<Job, "id" | "jobNumber" | "title" | "scheduledFor">>): TimelineEventItem[] {
  return jobs
    .filter((job) => Boolean(job.scheduledFor))
    .map((job) => ({
      id: `job-${job.id}-scheduled`,
      title: "Job scheduled",
      description: `${job.title} (${job.jobNumber}) is scheduled.`,
      occurredAt: job.scheduledFor,
      source: "job",
      href: ROUTE_BUILDERS.JOB_DETAIL(job.id),
      hrefLabel: "Open job detail",
    }));
}

export async function buildCustomerTimelineEvents({
  customer,
  properties,
  jobs,
}: {
  customer: Customer;
  properties: CustomerPropertyItem[];
  jobs: CustomerJobItem[];
}): Promise<TimelineEventItem[]> {
  const { activity, dispatchEvents } = await buildJobEventFeed(jobs.map((job) => job.id));
  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  const customerEvents: TimelineEventItem[] = [
    {
      id: `customer-${customer.id}-created`,
      title: "Customer record created",
      description: `${customer.name} was created in LOOP.`,
      occurredAt: customer.createdAt,
      source: "customer",
      href: ROUTE_BUILDERS.CUSTOMER_DETAIL(customer.id),
      hrefLabel: "Open customer",
    },
  ];

  const propertyEvents: TimelineEventItem[] = properties
    .filter((property) => Boolean(property.createdAt))
    .map((property) => ({
      id: `property-${property.id}-linked`,
      title: "Property linked to customer",
      description: `${property.name} was added to this customer portfolio.`,
      occurredAt: property.createdAt!,
      source: "property",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(property.id),
      hrefLabel: "Open property",
    }));

  const jobEvents = buildJobScheduledEvents(
    jobs.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber ?? "Draft job",
      title: job.title,
      scheduledFor: job.scheduledFor,
    })),
  );

  const jobActivityEvents: TimelineEventItem[] = activity.map((entry) => {
    const job = jobMap.get(entry.jobId);
    return {
      id: `job-activity-${entry.id}`,
      title: entry.title,
      description: entry.description,
      occurredAt: entry.timestamp,
      source: "job_activity",
      actor: entry.actorId,
      href: ROUTE_BUILDERS.JOB_DETAIL(entry.jobId),
      hrefLabel: job ? `Open ${job.title}` : "Open job detail",
    };
  });

  const dispatchTimelineEvents: TimelineEventItem[] = dispatchEvents.map(({ event, plan }) => ({
    id: `dispatch-${event.id}`,
    title: getDispatchEventTitle(event.type),
    description: event.description,
    occurredAt: event.timestamp,
    source: "dispatch_event",
    href: ROUTE_BUILDERS.JOB_DETAIL(plan.jobId),
    hrefLabel: `Open ${plan.jobNumber}`,
  }));

  return [
    ...customerEvents,
    ...propertyEvents,
    ...jobEvents,
    ...jobActivityEvents,
    ...dispatchTimelineEvents,
  ];
}

export async function buildPropertyTimelineEvents({
  property,
  jobs,
  installedSystems,
}: {
  property: Property;
  jobs: Job[];
  installedSystems: InstalledSystem[];
}): Promise<TimelineEventItem[]> {
  const { activity, dispatchEvents } = await buildJobEventFeed(jobs.map((job) => job.id));
  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  const propertyEvents: TimelineEventItem[] = [
    {
      id: `property-${property.id}-created`,
      title: "Property record created",
      description: `${property.name} was created in LOOP.`,
      occurredAt: property.createdAt,
      source: "property",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(property.id),
      hrefLabel: "Open property",
    },
    {
      id: `property-${property.id}-last-visit`,
      title: "Latest recorded service visit",
      description: `Most recent recorded visit for ${property.name}.`,
      occurredAt: property.lastVisit,
      source: "property",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(property.id),
      hrefLabel: "Open property",
    },
  ];

  const installedSystemEvents: TimelineEventItem[] = installedSystems.map((system) => ({
    id: `installed-system-${system.id}-install`,
    title: "Installed system recorded",
    description: `${system.systemName} captured with lifecycle status ${system.lifecycleStatus}.`,
    occurredAt: system.installDate,
    source: "installed_system",
    href: ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system.id),
    hrefLabel: "Open installed system",
  }));

  const jobEvents = buildJobScheduledEvents(jobs);

  const jobActivityEvents: TimelineEventItem[] = activity.map((entry) => {
    const job = jobMap.get(entry.jobId);
    return {
      id: `job-activity-${entry.id}`,
      title: entry.title,
      description: entry.description,
      occurredAt: entry.timestamp,
      source: "job_activity",
      actor: entry.actorId,
      href: ROUTE_BUILDERS.JOB_DETAIL(entry.jobId),
      hrefLabel: job ? `Open ${job.title}` : "Open job detail",
    };
  });

  const dispatchTimelineEvents: TimelineEventItem[] = dispatchEvents.map(({ event, plan }) => ({
    id: `dispatch-${event.id}`,
    title: getDispatchEventTitle(event.type),
    description: event.description,
    occurredAt: event.timestamp,
    source: "dispatch_event",
    href: ROUTE_BUILDERS.JOB_DETAIL(plan.jobId),
    hrefLabel: `Open ${plan.jobNumber}`,
  }));

  return [
    ...propertyEvents,
    ...installedSystemEvents,
    ...jobEvents,
    ...jobActivityEvents,
    ...dispatchTimelineEvents,
  ];
}
