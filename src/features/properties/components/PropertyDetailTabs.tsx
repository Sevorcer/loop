"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  FileText,
  HardHat,
  ImageIcon,
  Mail,
  Phone,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import {
  AtlasTabs,
  AtlasTimeline,
  EmptyState,
  StatusBadge,
} from "@/components/atlas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { ROUTE_BUILDERS } from "@/lib/routes";
import type { Customer } from "@/features/customers/types/customer";
import type { CustomerPropertyItem } from "@/features/customers/types/customerDetails";

import type { Job } from "@/features/jobs/types/job";
import type { Property } from "../types/property";
import type {
  PropertyDetails,
  PropertyDocumentItem,
  PropertyPhotoItem,
  PropertyTimelineEvent,
} from "../types/propertyDetails";

type PropertyDetailTabKey =
  | "overview"
  | "equipment"
  | "jobs"
  | "timeline"
  | "documents"
  | "photos"
  | "customer"
  | "warranty"
  | "notes";

type PropertyDetailTab = {
  key: PropertyDetailTabKey;
  label: string;
};

const tabs: PropertyDetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "equipment", label: "Equipment" },
  { key: "jobs", label: "Jobs" },
  { key: "timeline", label: "Timeline" },
  { key: "documents", label: "Documents" },
  { key: "photos", label: "Photos" },
  { key: "customer", label: "Customer" },
  { key: "warranty", label: "Warranty" },
  { key: "notes", label: "Notes" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getTimelineIcon(icon: PropertyTimelineEvent["icon"]) {
  if (icon === "property") return Building2;
  if (icon === "install") return HardHat;
  return ClipboardList;
}

function getPropertyDetails(property: Property): PropertyDetails {
  return {
    propertyId: property.id,
    beforeYouGoItems: [
      "Confirm arrival access details before dispatch.",
      "Review latest property notes before leaving the shop.",
      "Verify required equipment and materials before arrival.",
    ],
    homeIntelligenceItems: [
      "Property detail profile is active and ready for future field notes.",
      "No additional operational intelligence has been recorded yet.",
    ],
    equipment: property.primarySystem
      ? [
          {
            id: `${property.id}-equipment-primary`,
            name: property.primarySystem,
            kind: "Primary system",
            status:
              property.status === "Inactive" ? "Needs review" : "Operational",
            serial: "Pending",
            installDate: property.createdAt,
          },
        ]
      : [],
    jobs: [],
    timeline: [
      {
        id: `${property.id}-timeline-created`,
        title: "Property created in LOOP",
        date: property.createdAt,
        description:
          "Property profile added and made available for scheduling.",
        icon: "property",
      },
      {
        id: `${property.id}-timeline-last-visit`,
        title: "Last recorded property visit",
        date: property.lastVisit,
        description:
          "Latest property activity recorded for historical visibility.",
        icon: "service",
      },
    ],
    contacts: [
      {
        id: `${property.id}-contact-primary`,
        name: property.customer,
        role: "Primary Customer",
        phone: "Not recorded",
        preference: "Not recorded",
      },
    ],
    warranty: [
      {
        id: `${property.id}-warranty-registration`,
        title: "Registration",
        description:
          "Warranty registration details have not been recorded yet.",
      },
    ],
    notes: ["No operational notes have been recorded yet."],
    documents: [],
    photos: [],
  };
}

function getDocumentVariant(status: PropertyDocumentItem["status"]) {
  if (status === "Ready") return "success" as const;
  if (status === "Pending Review") return "warning" as const;
  return "neutral" as const;
}

function getPhotoVariant(status: PropertyPhotoItem["status"]) {
  if (status === "Complete") return "success" as const;
  if (status === "Required") return "warning" as const;
  return "neutral" as const;
}

function OverviewSection({
  recentJobs,
  jobsLoading,
  lastVisit,
  beforeYouGoItems,
  homeIntelligenceItems,
}: {
  recentJobs: Job[];
  jobsLoading: boolean;
  lastVisit: string;
  beforeYouGoItems: string[];
  homeIntelligenceItems: string[];
}) {
  const recentItems = useMemo(() => {
    if (jobsLoading) return null;
    if (recentJobs.length > 0) {
      return recentJobs.slice(0, 3).map((job) => ({
        date: formatDate(job.scheduledFor),
        title: job.title,
        id: job.id,
      }));
    }
    return [{ date: formatDate(lastVisit), title: "Latest recorded property activity", id: "last-visit" }];
  }, [recentJobs, jobsLoading, lastVisit]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Job Stories</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {jobsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : (recentItems ?? []).map((story) => (
              <div
                key={story.id}
                className="flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="font-medium">{story.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {story.date}
                  </p>
                </div>

                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Before You Go</CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <ul className="space-y-4 text-sm text-muted-foreground">
              {beforeYouGoItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Home Intelligence</CardTitle>
          </CardHeader>

          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {homeIntelligenceItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EquipmentSection({ details }: { details: PropertyDetails }) {
  if (details.equipment.length === 0) {
    return (
      <EmptyState
        title="No equipment recorded yet"
        description="Equipment records will appear here once systems and controls are documented for this property."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {details.equipment.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{item.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.kind}
                </p>
              </div>

              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge
                variant={
                  item.status === "Operational" || item.status === "Online"
                    ? "success"
                    : "warning"
                }
              >
                {item.status}
              </StatusBadge>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Serial</span>
              <span className="font-medium">{item.serial}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Installed</span>
              <span className="font-medium">{formatDate(item.installDate)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function JobsSection({
  jobs,
  loading,
}: {
  jobs: Job[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No related jobs yet"
        description="Scheduled service, install, and warranty work for this property will appear here."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Jobs</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {jobs.map((job) => (
          <Link key={job.id} href={ROUTE_BUILDERS.JOB_DETAIL(job.id)} className="block">
            <div className="rounded-xl border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{job.jobNumber}</p>
                </div>

                <StatusBadge
                  variant={job.status === "Completed" ? "success" : "warning"}
                >
                  {job.status}
                </StatusBadge>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide">Scheduled For</p>
                  <p className="mt-1 font-medium text-foreground">
                    {formatDate(job.scheduledFor)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide">Assigned To</p>
                  <p className="mt-1 font-medium text-foreground">{job.assignedTo}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function TimelineSection({ details }: { details: PropertyDetails }) {
  const timelineItems = useMemo(
    () =>
      details.timeline.map((event) => ({
        id: event.id,
        title: event.title,
        date: formatDate(event.date),
        description: event.description,
        icon: getTimelineIcon(event.icon),
      })),
    [details.timeline]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Timeline</CardTitle>
      </CardHeader>

      <CardContent>
        <AtlasTimeline items={timelineItems} />
      </CardContent>
    </Card>
  );
}

function DocumentsSection({ details }: { details: PropertyDetails }) {
  if (details.documents.length === 0) {
    return (
      <EmptyState
        title="No documents available yet"
        description="Property documents will appear here once permits, manuals, startup packets, or warranty files are uploaded."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {details.documents.map((document) => (
        <Card key={document.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{document.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {document.category}
                </p>
              </div>

              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge variant={getDocumentVariant(document.status)}>
                {document.status}
              </StatusBadge>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Uploaded</span>
              <span className="font-medium">
                {formatDate(document.uploadedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PhotosSection({ details }: { details: PropertyDetails }) {
  if (details.photos.length === 0) {
    return (
      <EmptyState
        title="No photos uploaded yet"
        description="Required install photos, QC images, and completion photos will appear here for this property."
      />
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {details.photos.map((photo) => (
        <Card key={photo.id}>
          <CardContent className="p-0">
            <div className="flex aspect-[4/3] items-center justify-center rounded-t-xl bg-muted/40">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="space-y-3 p-4">
              <div>
                <p className="font-medium">{photo.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {photo.category}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge variant={getPhotoVariant(photo.status)}>
                  {photo.status}
                </StatusBadge>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Captured: </span>
                <span className="font-medium">
                  {formatDate(photo.capturedAt)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CustomerHubSection({
  property,
  customer,
  customerProperties,
}: {
  property: Property;
  customer: Customer | null;
  customerProperties: CustomerPropertyItem[];
}) {
  if (!customer) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No linked customer"
          description="This property has no linked customer record. Assign a customer to unlock the full customer hub."
        />
      </div>
    );
  }

  const statusVariant =
    customer.status === "Active"
      ? "success"
      : customer.status === "Prospect"
        ? "warning"
        : "neutral";

  // Sibling properties: other properties owned by this customer, excluding the current one
  const siblingProperties = customerProperties.filter((p) => p.id !== property.id);

  return (
    <div className="space-y-6">
      {/* Customer profile card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{customer.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Linked customer account
              </p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge variant={statusVariant}>{customer.status}</StatusBadge>
          </div>

          {customer.primaryContact ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Primary Contact</span>
              <span className="font-medium">{customer.primaryContact}</span>
            </div>
          ) : null}

          {customer.phone ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Phone</span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </span>
            </div>
          ) : null}

          {customer.email ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Mail className="h-3.5 w-3.5" />
                {customer.email}
              </span>
            </div>
          ) : null}

          {customer.city ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">City</span>
              <span className="font-medium">{customer.city}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Portfolio</span>
            <span className="font-medium">
              {customer.propertyCount} {customer.propertyCount === 1 ? "property" : "properties"},{" "}
              {customer.openJobs} open {customer.openJobs === 1 ? "job" : "jobs"}
            </span>
          </div>

          <div className="pt-2 border-t">
            <Link
              href={ROUTE_BUILDERS.CUSTOMER_DETAIL(customer.id)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
            >
              View Full Customer Profile
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Customer portfolio: sibling properties */}
      {siblingProperties.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Other Properties in Portfolio</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Additional properties linked to {customer.name}
                </p>
              </div>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              {siblingProperties.map((sibling) => (
                <Link
                  key={sibling.id}
                  href={ROUTE_BUILDERS.PROPERTY_DETAIL(sibling.id)}
                  className="block"
                >
                  <div className="rounded-xl border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{sibling.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sibling.address}, {sibling.city}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <StatusBadge
                        variant={sibling.status === "Active" ? "success" : "warning"}
                      >
                        {sibling.status}
                      </StatusBadge>
                      <span className="text-muted-foreground">{sibling.primarySystem}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Other Properties in Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is the only property linked to {customer.name}.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WarrantySection({ details }: { details: PropertyDetails }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Warranty Coverage</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4 lg:grid-cols-3">
        {details.warranty.map((item) => (
          <div key={item.id} className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{item.title}</p>
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NotesSection({ details }: { details: PropertyDetails }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Notes</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {details.notes.map((note, index) => (
          <div
            key={`${index}-${note}`}
            className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground"
          >
            {note}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface PropertyDetailTabsProps {
  property: Property;
  customer: Customer | null;
  customerProperties: CustomerPropertyItem[];
}

export function PropertyDetailTabs({
  property,
  customer,
  customerProperties,
}: PropertyDetailTabsProps) {
  const { role } = useCurrentRole();
  const [activeTab, setActiveTab] = useState<PropertyDetailTabKey>("overview");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsFetched, setJobsFetched] = useState(false);

  const details = useMemo(() => getPropertyDetails(property), [property]);

  // Derive loading from whether the tab is relevant and data hasn't been fetched yet
  const jobsLoading = (activeTab === "jobs" || activeTab === "overview") && !jobsFetched && Boolean(role);

  useEffect(() => {
    if ((activeTab !== "jobs" && activeTab !== "overview") || jobsFetched || !role) {
      return;
    }

    requestJson<{ jobs: Job[] }>(
      `/api/properties/${property.id}/jobs`,
      { role, cache: "no-store" },
    )
      .then((response) => {
        setJobs(response.jobs);
        setJobsFetched(true);
      })
      .catch(() => {
        setJobsFetched(true);
      });
  }, [activeTab, property.id, jobsFetched, role]);

  return (
    <div className="space-y-6">
      <AtlasTabs
        items={tabs}
        value={activeTab}
        onChange={setActiveTab}
        sticky
      />

      {activeTab === "overview" ? (
        <OverviewSection
          recentJobs={jobs}
          jobsLoading={jobsLoading}
          lastVisit={property.lastVisit}
          beforeYouGoItems={details.beforeYouGoItems}
          homeIntelligenceItems={details.homeIntelligenceItems}
        />
      ) : null}

      {activeTab === "equipment" ? (
        <EquipmentSection details={details} />
      ) : null}

      {activeTab === "jobs" ? (
        <JobsSection jobs={jobs} loading={jobsLoading} />
      ) : null}

      {activeTab === "timeline" ? (
        <TimelineSection details={details} />
      ) : null}

      {activeTab === "documents" ? (
        <DocumentsSection details={details} />
      ) : null}

      {activeTab === "photos" ? <PhotosSection details={details} /> : null}

      {activeTab === "customer" ? (
        <CustomerHubSection
          property={property}
          customer={customer}
          customerProperties={customerProperties}
        />
      ) : null}

      {activeTab === "warranty" ? (
        <WarrantySection details={details} />
      ) : null}

      {activeTab === "notes" ? <NotesSection details={details} /> : null}
    </div>
  );
}
