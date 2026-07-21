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
import { useCustomerSnapshot } from "../hooks/useCustomerSnapshot";

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
  | "contacts"
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
  { key: "contacts", label: "Contacts" },
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

function ContactsSection({
  details,
  property,
}: {
  details: PropertyDetails;
  property: Property;
}) {
  const { customer, loading } = useCustomerSnapshot(property.customerId);

  return (
    <div className="space-y-6">
      {/* Linked customer account card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Customer Account</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Linked customer record for this property
              </p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading customer details…</p>
          ) : customer ? (
            <>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{customer.name}</span>
              </div>

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

              {customer.primaryContact ? (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Primary Contact</span>
                  <span className="font-medium">{customer.primaryContact}</span>
                </div>
              ) : null}

              {property.customerId ? (
                <div className="pt-2">
                  <Link
                    href={ROUTE_BUILDERS.CUSTOMER_DETAIL(property.customerId)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
                  >
                    View Full Customer Profile
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{property.customer}</span>
              </div>

              <p className="text-sm text-muted-foreground">
                A customer name is recorded, but no linked customer profile was found.
                Full contact details will appear here once the customer record is linked.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional property-level contacts (excludes the primary customer shown above) */}
      {(() => {
        const extraContacts = details.contacts.filter((c) => c.role !== "Primary Customer");
        if (extraContacts.length === 0) return null;

        return (
          <div className="grid gap-6 lg:grid-cols-2">
            {extraContacts.map((contact) => (
              <Card key={contact.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{contact.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{contact.role}</p>
                    </div>

                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{contact.phone}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Arrival Preference</span>
                    <span className="font-medium">{contact.preference}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}
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

export function PropertyDetailTabs({ property }: { property: Property }) {
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

      {activeTab === "contacts" ? (
        <ContactsSection details={details} property={property} />
      ) : null}

      {activeTab === "warranty" ? (
        <WarrantySection details={details} />
      ) : null}

      {activeTab === "notes" ? <NotesSection details={details} /> : null}
    </div>
  );
}
