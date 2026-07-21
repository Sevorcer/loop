"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

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

import type { Customer } from "../types/customer";
import type {
  CustomerContactItem,
  CustomerDetails,
  CustomerJobItem,
  CustomerNoteItem,
  CustomerPropertyItem,
  CustomerTimelineItem,
} from "../types/customerDetails";
import type { Property } from "@/features/properties/types/property";
import type { Job } from "@/features/jobs/types/job";

type CustomerDetailTabKey =
  | "overview"
  | "properties"
  | "jobs"
  | "contacts"
  | "timeline"
  | "notes";

type CustomerDetailTab = {
  key: CustomerDetailTabKey;
  label: string;
};

const tabs: CustomerDetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "properties", label: "Properties" },
  { key: "jobs", label: "Jobs" },
  { key: "contacts", label: "Contacts" },
  { key: "timeline", label: "Timeline" },
  { key: "notes", label: "Notes" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function buildStaticDetails(customer: Customer): Omit<CustomerDetails, "properties" | "jobs"> {
  return {
    customerId: customer.id,
    accountSummary: [
      "Customer profile is active and ready for deeper service relationship tracking.",
      "No additional account intelligence has been recorded yet.",
    ],
    contacts: [
      {
        id: `${customer.id}-primary-contact`,
        name: customer.primaryContact,
        role: "Primary Contact",
        phone: customer.phone,
        email: customer.email,
        preference: "Not recorded",
      },
    ],
    timeline: [
      {
        id: `${customer.id}-timeline-created`,
        title: "Customer created in LOOP",
        date: customer.createdAt,
        description: "Customer account was added and made available for operations.",
      },
      {
        id: `${customer.id}-timeline-activity`,
        title: "Latest recorded activity",
        date: customer.lastActivity,
        description: "Latest account activity recorded for historical visibility.",
      },
    ],
    notes: [
      {
        id: `${customer.id}-note-default`,
        body: "No account notes have been recorded yet.",
      },
    ],
  };
}

function OverviewSection({
  accountSummary,
}: {
  accountSummary: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Summary</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="space-y-4 text-sm text-muted-foreground">
          {accountSummary.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PropertiesSection({
  properties,
  loading,
}: {
  properties: CustomerPropertyItem[];
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

  if (properties.length === 0) {
    return (
      <EmptyState
        title="No linked properties yet"
        description="Properties connected to this customer account will appear here."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {properties.map((property) => (
        <Link key={property.id} href={ROUTE_BUILDERS.PROPERTY_DETAIL(property.id)} className="block">
          <Card className="hover-lift h-full transition-atlas hover:border-primary/40">
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
                <StatusBadge
                  variant={property.status === "Active" ? "success" : "warning"}
                >
                  {property.status}
                </StatusBadge>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Primary System</span>
                <span className="font-medium">{property.primarySystem}</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function JobsSection({
  jobs,
  loading,
}: {
  jobs: CustomerJobItem[];
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
        title="No jobs linked yet"
        description="Jobs related to this customer account will appear here."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Jobs</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {jobs.map((job) => (
          <Link key={job.id} href={ROUTE_BUILDERS.JOB_DETAIL(job.id)} className="block">
            <div className="rounded-xl border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{job.id}</p>
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
                  <p className="text-xs uppercase tracking-wide">Property</p>
                  <p className="mt-1 font-medium text-foreground">
                    {job.propertyName}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ContactsSection({ contacts }: { contacts: CustomerContactItem[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {contacts.map((contact) => (
        <Card key={contact.id}>
          <CardHeader>
            <CardTitle>{contact.name}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{contact.role}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{contact.phone}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{contact.email}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Preference</span>
              <span className="font-medium">{contact.preference}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TimelineSection({ timeline }: { timeline: CustomerTimelineItem[] }) {
  const timelineItems = useMemo(
    () =>
      timeline.map((event) => ({
        id: event.id,
        title: event.title,
        date: formatDate(event.date),
        description: event.description,
      })),
    [timeline]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Timeline</CardTitle>
      </CardHeader>

      <CardContent>
        <AtlasTimeline items={timelineItems} />
      </CardContent>
    </Card>
  );
}

function NotesSection({ notes }: { notes: CustomerNoteItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Notes</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground"
          >
            {note.body}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CustomerDetailTabs({ customer }: { customer: Customer }) {
  const { role } = useCurrentRole();
  const [activeTab, setActiveTab] = useState<CustomerDetailTabKey>("overview");

  const [properties, setProperties] = useState<CustomerPropertyItem[]>([]);
  const [propertiesFetched, setPropertiesFetched] = useState(false);

  const [jobs, setJobs] = useState<CustomerJobItem[]>([]);
  const [jobsFetched, setJobsFetched] = useState(false);

  const staticDetails = useMemo(() => buildStaticDetails(customer), [customer]);

  // Derive loading from whether the tab is active and the data hasn't been fetched yet
  const propertiesLoading = activeTab === "properties" && !propertiesFetched && Boolean(role);
  const jobsLoading = activeTab === "jobs" && !jobsFetched && Boolean(role);

  useEffect(() => {
    if (activeTab !== "properties" || propertiesFetched || !role) {
      return;
    }

    requestJson<{ properties: Property[] }>(
      `/api/customers/${customer.id}/properties`,
      { role, cache: "no-store" },
    )
      .then((response) => {
        setProperties(
          response.properties.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            city: p.city,
            status: p.status,
            primarySystem: p.primarySystem,
          })),
        );
        setPropertiesFetched(true);
      })
      .catch(() => {
        setPropertiesFetched(true);
      });
  }, [activeTab, customer.id, propertiesFetched, role]);

  useEffect(() => {
    if (activeTab !== "jobs" || jobsFetched || !role) {
      return;
    }

    requestJson<{ jobs: Job[] }>(
      `/api/customers/${customer.id}/jobs`,
      { role, cache: "no-store" },
    )
      .then((response) => {
        setJobs(
          response.jobs.map((j) => ({
            id: j.id,
            title: j.title,
            status: j.status,
            scheduledFor: j.scheduledFor,
            propertyName: j.propertyName,
          })),
        );
        setJobsFetched(true);
      })
      .catch(() => {
        setJobsFetched(true);
      });
  }, [activeTab, customer.id, jobsFetched, role]);

  return (
    <div className="space-y-6">
      <AtlasTabs
        items={tabs}
        value={activeTab}
        onChange={setActiveTab}
        sticky
      />

      {activeTab === "overview" ? (
        <OverviewSection accountSummary={staticDetails.accountSummary} />
      ) : null}

      {activeTab === "properties" ? (
        <PropertiesSection properties={properties} loading={propertiesLoading} />
      ) : null}

      {activeTab === "jobs" ? (
        <JobsSection jobs={jobs} loading={jobsLoading} />
      ) : null}

      {activeTab === "contacts" ? (
        <ContactsSection contacts={staticDetails.contacts} />
      ) : null}

      {activeTab === "timeline" ? (
        <TimelineSection timeline={staticDetails.timeline} />
      ) : null}

      {activeTab === "notes" ? <NotesSection notes={staticDetails.notes} /> : null}
    </div>
  );
}
