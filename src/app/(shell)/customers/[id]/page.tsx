import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import { getCustomer, getCustomerJobs, getCustomerProperties } from "@/services/customers";
import { getInstalledSystemsSnapshot } from "@/services/installedSystems";
import { buildCustomerTimelineEvents } from "@/services/timeline";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; propertyId?: string }>;
}

export default async function CustomerDetailPage({ params, searchParams }: CustomerDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const [customer, properties, jobs] = await Promise.all([
    getCustomer(id),
    getCustomerProperties(id),
    getCustomerJobs(id).catch((err: unknown) => {
      console.error("[customers/detail] job fetch failed – displaying page without job history", {
        customerId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as Awaited<ReturnType<typeof getCustomerJobs>>;
    }),
  ]);

  if (!customer) {
    notFound();
  }

  const propertyIds = new Set(properties.map((property) => property.id));
  const systemsState = await getInstalledSystemsSnapshot()
    .then((snapshot) => ({
      systems: snapshot.installedSystems
        .filter((system) => system.propertyId && propertyIds.has(system.propertyId))
        .map((system) => ({
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

  const timelineState = await buildCustomerTimelineEvents({
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

  return (
    <CustomerDetailScreen
      customer={customer}
      properties={properties}
      jobs={jobs}
      installedSystems={systemsState.systems}
      timelineItems={timelineState.items}
      timelineError={timelineState.error}
      systemsError={systemsState.error}
      initialTab={query.tab}
      initialPropertyId={query.propertyId}
    />
  );
}
