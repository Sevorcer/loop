import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import {
  getCustomer,
  getCustomerJobs,
  getCustomerJobScopeCounts,
  getCustomerProperties,
} from "@/services/customers";
import { listCustomerContacts } from "@/services/customerContacts";
import { getInstalledSystemsForProperties } from "@/services/installedSystems";
import { buildCustomerTimelineEvents } from "@/services/timeline";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; propertyId?: string }>;
}

export default async function CustomerDetailPage({ params, searchParams }: CustomerDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const [customer, properties, jobs, jobScopeCounts, contacts] = await Promise.all([
    getCustomer(id),
    getCustomerProperties(id),
    getCustomerJobs(id).catch((err: unknown) => {
      console.error("[customers/detail] job fetch failed – displaying page without job history", {
        customerId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as Awaited<ReturnType<typeof getCustomerJobs>>;
    }),
    // Exact head counts (parent + child customers) for the "Jobs in Scope"
    // tile. A capped job list cannot be counted with `.length`.
    getCustomerJobScopeCounts(id).catch((err: unknown) => {
      console.error("[customers/detail] job scope count failed – falling back to list length", {
        customerId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }),
    listCustomerContacts(id).catch((err: unknown) => {
      console.error("[customers/detail] contacts fetch failed", {
        customerId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as Awaited<ReturnType<typeof listCustomerContacts>>;
    }),
  ]);

  if (!customer) {
    notFound();
  }

  // Only this customer's properties' systems (was: every installed system in
  // the company, filtered here). Runs in parallel with the timeline build.
  const propertyIds = properties.map((property) => property.id);
  const systemsPromise = getInstalledSystemsForProperties(propertyIds)
    .then((installedSystems) => ({
      systems: installedSystems.map((system) => ({
        id: system.id,
        systemName: system.systemName,
        lifecycleStatus: system.lifecycleStatus,
        propertyId: system.propertyId,
        propertyName: system.propertyName,
        installDate: system.installDate,
        manufacturer: system.manufacturer,
        modelNumber: system.modelNumber,
      })),
      error: undefined,
    }))
    .catch((error: unknown) => {
      console.error("[customers] failed to load installed systems snapshot", {
        customerId: id,
        error,
      });
      return { systems: [], error: "Installed systems are temporarily unavailable." };
    });

  const timelinePromise = buildCustomerTimelineEvents({
    customer,
    properties,
    jobs,
  })
    .then((items) => ({ items, error: undefined }))
    .catch((error: unknown) => {
      console.error("[customers] failed to build customer timeline", {
        customerId: id,
        error,
      });
      return {
        items: [],
        error: "Timeline history is temporarily unavailable. Customer contact and property details remain available.",
      };
    });

  const [systemsState, timelineState] = await Promise.all([systemsPromise, timelinePromise]);

  return (
    <CustomerDetailScreen
      customer={customer}
      contacts={contacts}
      properties={properties}
      jobs={jobs}
      jobScopeCounts={jobScopeCounts}
      installedSystems={systemsState.systems}
      timelineItems={timelineState.items}
      timelineError={timelineState.error}
      systemsError={systemsState.error}
      initialTab={query.tab}
      initialPropertyId={query.propertyId}
    />
  );
}
