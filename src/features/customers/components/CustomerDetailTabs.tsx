"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Building2, CalendarClock, ClipboardList, User, Users, Wrench } from "lucide-react";

import { AtlasTabs, AtlasTimeline, EmptyState, ErrorState, PermissionGuard, StatusBadge } from "@/components/atlas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TimelineEventItem } from "@/lib/timeline";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { formatDateOnly } from "@/lib/dates";

import type { Customer } from "../types/customer";
import type {
  CustomerInstalledSystemItem,
  CustomerJobItem,
  CustomerPropertyItem,
} from "../types/customerDetails";

type CustomerDetailTabKey =
  | "overview"
  | "jobs"
  | "properties"
  | "systems"
  | "timeline"
  | "docs"
  | "financials";

type CustomerDetailTab = {
  key: CustomerDetailTabKey;
  label: string;
};

const tabs: CustomerDetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "jobs", label: "Jobs" },
  { key: "properties", label: "Properties" },
  { key: "systems", label: "Systems" },
  { key: "timeline", label: "Timeline" },
  { key: "docs", label: "Docs" },
  { key: "financials", label: "Financials" },
];

const TAB_KEYS = new Set<CustomerDetailTabKey>(tabs.map((tab) => tab.key));

function formatDate(value: string) {
  return formatDateOnly(value);
}

function normalizeTab(value?: string): CustomerDetailTabKey {
  if (value && TAB_KEYS.has(value as CustomerDetailTabKey)) {
    return value as CustomerDetailTabKey;
  }
  return "overview";
}

function getTimelineIcon(source: TimelineEventItem["source"]) {
  switch (source) {
    case "customer":
      return Users;
    case "property":
      return Building2;
    case "job":
      return CalendarClock;
    case "job_activity":
      return ClipboardList;
    case "dispatch_event":
      return Wrench;
    default:
      return User;
  }
}

function getSourceLabel(source: TimelineEventItem["source"]) {
  switch (source) {
    case "customer":
      return "Customer";
    case "property":
      return "Property";
    case "job":
      return "Job";
    case "job_activity":
      return "Job Activity";
    case "dispatch_event":
      return "Dispatch";
    default:
      return "System";
  }
}

interface CustomerDocItem {
  id: string;
  propertyId?: string;
  title: string;
  description: string;
}

interface CustomerDetailTabsProps {
  customer: Customer;
  properties: CustomerPropertyItem[];
  jobs: CustomerJobItem[];
  installedSystems: CustomerInstalledSystemItem[];
  timelineItems: TimelineEventItem[];
  timelineError?: string;
  systemsError?: string;
  initialTab?: string;
  initialPropertyId?: string;
}

export function CustomerDetailTabs({
  customer,
  properties,
  jobs,
  installedSystems,
  timelineItems,
  timelineError,
  systemsError,
  initialTab,
  initialPropertyId,
}: CustomerDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<CustomerDetailTabKey>(normalizeTab(initialTab));
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(() =>
    initialPropertyId && properties.some((property) => property.id === initialPropertyId)
      ? initialPropertyId
      : undefined,
  );

  const docs = useMemo<CustomerDocItem[]>(
    () => [
      ...properties.map((property) => ({
        id: `property-doc-${property.id}`,
        propertyId: property.id,
        title: `${property.name} service profile`,
        description: `${property.address}, ${property.city}`,
      })),
      ...installedSystems.map((system) => ({
        id: `system-doc-${system.id}`,
        propertyId: system.propertyId,
        title: `${system.systemName} equipment record`,
        description: `${system.manufacturer || "Unknown manufacturer"} ${system.modelNumber || "model pending"}`,
      })),
    ],
    [installedSystems, properties],
  );

  const filteredJobs = useMemo(
    () =>
      selectedPropertyId
        ? jobs.filter((job) => job.propertyId === selectedPropertyId)
        : jobs,
    [jobs, selectedPropertyId],
  );

  const filteredSystems = useMemo(
    () =>
      selectedPropertyId
        ? installedSystems.filter((system) => system.propertyId === selectedPropertyId)
        : installedSystems,
    [installedSystems, selectedPropertyId],
  );

  const filteredTimeline = useMemo(
    () =>
      selectedPropertyId
        ? timelineItems.filter((item) => item.relatedPropertyId === selectedPropertyId)
        : timelineItems,
    [selectedPropertyId, timelineItems],
  );

  const filteredDocs = useMemo(
    () =>
      selectedPropertyId ? docs.filter((doc) => doc.propertyId === selectedPropertyId) : docs,
    [docs, selectedPropertyId],
  );

  const scopedProperty = useMemo(
    () =>
      selectedPropertyId
        ? properties.find((property) => property.id === selectedPropertyId)
        : undefined,
    [properties, selectedPropertyId],
  );

  const updateUrl = (nextTab: CustomerDetailTabKey, nextPropertyId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    if (nextPropertyId) {
      params.set("propertyId", nextPropertyId);
    } else {
      params.delete("propertyId");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleTabChange = (nextTab: CustomerDetailTabKey) => {
    setActiveTab(nextTab);
    updateUrl(nextTab, selectedPropertyId);
  };

  const handlePropertyLensChange = (nextPropertyId?: string) => {
    setSelectedPropertyId(nextPropertyId);
    updateUrl(activeTab, nextPropertyId);
  };

  const openJobHref = ROUTE_BUILDERS.JOB_NEW({
    customerId: customer.id,
    propertyId: scopedProperty?.id,
  });

  const addPropertyHref = ROUTE_BUILDERS.PROPERTY_NEW({ customerId: customer.id });

  return (
    <div className="space-y-6">
      <AtlasTabs items={tabs} value={activeTab} onChange={handleTabChange} sticky />

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Property Lens</p>
            <div className="flex items-center gap-2">
              <PermissionGuard table="properties" action="insert">
                <Link href={addPropertyHref}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Add Property
                  </Button>
                </Link>
              </PermissionGuard>
              <PermissionGuard table="jobs" action="insert">
                <Link href={openJobHref}>
                  <Button size="sm" className="gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Create Job
                  </Button>
                </Link>
              </PermissionGuard>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={selectedPropertyId ? "ghost" : "primary"}
              onClick={() => handlePropertyLensChange(undefined)}
              className="rounded-full"
            >
              All Properties
            </Button>
            {properties.map((property) => (
              <Button
                key={property.id}
                type="button"
                variant={selectedPropertyId === property.id ? "primary" : "ghost"}
                onClick={() => handlePropertyLensChange(property.id)}
                className="rounded-full"
              >
                {property.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeTab === "overview" ? (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Property Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{selectedPropertyId ? 1 : properties.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedPropertyId
                  ? "Viewing one scoped property in this customer workspace."
                  : "All linked properties in this customer workspace."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Jobs in Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{filteredJobs.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Scheduled and active customer jobs in the selected lens.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Systems in Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{filteredSystems.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Installed systems visible for the selected property lens.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "properties" ? (
        properties.length === 0 ? (
          <EmptyState
            title="No linked properties yet"
            description="Properties connected to this customer account will appear here."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {properties.map((property) => (
              <Card key={property.id} className="hover-lift h-full transition-atlas hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle>{property.name}</CardTitle>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">{property.address}</p>
                    <p className="text-muted-foreground">{property.city}</p>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge variant={property.status === "Active" ? "success" : "warning"}>
                      {property.status}
                    </StatusBadge>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Primary System</span>
                    <span className="font-medium">{property.primarySystem}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <Link href={ROUTE_BUILDERS.PROPERTY_DETAIL(property.id)}>
                      <Button variant="ghost" size="sm">Open Property</Button>
                    </Link>
                    <PermissionGuard table="jobs" action="insert">
                      <Link
                        href={ROUTE_BUILDERS.JOB_NEW({
                          customerId: customer.id,
                          propertyId: property.id,
                        })}
                      >
                        <Button size="sm" className="gap-2">
                          <CalendarClock className="h-4 w-4" />
                          Create Job
                        </Button>
                      </Link>
                    </PermissionGuard>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {activeTab === "jobs" ? (
        filteredJobs.length === 0 ? (
          <EmptyState
            title="No jobs in this scope"
            description="Create a job from the customer or selected property lens to get started."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Customer Jobs</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {filteredJobs.map((job) => (
                <Link key={job.id} href={ROUTE_BUILDERS.JOB_DETAIL(job.id)} className="block">
                  <div className="rounded-xl border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{job.id}</p>
                      </div>

                      <StatusBadge variant={job.status === "Completed" ? "success" : "warning"}>
                        {job.status}
                      </StatusBadge>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide">Scheduled For</p>
                        <p className="mt-1 font-medium text-foreground">{formatDate(job.scheduledFor)}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide">Property</p>
                        <p className="mt-1 font-medium text-foreground">{job.propertyName}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )
      ) : null}

      {activeTab === "systems" ? (
        systemsError ? (
          <ErrorState description={systemsError} />
        ) : filteredSystems.length === 0 ? (
          <EmptyState
            title="No installed systems in this scope"
            description="Installed systems linked to this customer will appear here."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Installed Systems</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {filteredSystems.map((system) => (
                <div key={system.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{system.systemName}</p>
                    <StatusBadge variant={system.lifecycleStatus === "Active" ? "success" : "warning"}>
                      {system.lifecycleStatus}
                    </StatusBadge>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>Property: {system.propertyName}</p>
                    <p>Installed: {formatDate(system.installDate)}</p>
                    <p>Manufacturer: {system.manufacturer || "Unknown"}</p>
                    <p>Model: {system.modelNumber || "Unknown"}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      ) : null}

      {activeTab === "timeline" ? (
        timelineError ? (
          <ErrorState description={timelineError} />
        ) : filteredTimeline.length === 0 ? (
          <EmptyState
            title="No timeline history in this scope"
            description="Customer events will appear here as scheduling and service updates happen."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Customer Timeline</CardTitle>
            </CardHeader>

            <CardContent>
              <AtlasTimeline
                items={filteredTimeline.map((event) => ({
                  ...event,
                  icon: getTimelineIcon(event.source),
                  sourceLabel: getSourceLabel(event.source),
                }))}
              />
            </CardContent>
          </Card>
        )
      ) : null}

      {activeTab === "docs" ? (
        filteredDocs.length === 0 ? (
          <EmptyState
            title="No documents in this scope"
            description="Customer and equipment document stubs will appear here as records are captured."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Customer Documents</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {filteredDocs.map((doc) => (
                <div key={doc.id} className="rounded-xl border bg-muted/20 p-4">
                  <p className="font-medium">{doc.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      ) : null}

      {activeTab === "financials" ? (
        <Card>
          <CardHeader>
            <CardTitle>Financials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Account status: {customer.status}</p>
            <p>Open jobs: {customer.openJobs}</p>
            <p>
              Portfolio scope: {selectedPropertyId ? scopedProperty?.name ?? "Selected property" : "All properties"}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
