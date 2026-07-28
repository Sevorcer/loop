"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  ClipboardList,
  User,
  Users,
  Wrench,
} from "lucide-react";

import {
  AtlasTabs,
  AtlasTimeline,
  EmptyState,
  ErrorState,
  StatusBadge,
} from "@/components/atlas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimelineEventItem } from "@/lib/timeline";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { Customer } from "../types/customer";
import type {
  CustomerContactItem,
  CustomerJobItem,
  CustomerNoteItem,
  CustomerPropertyItem,
} from "../types/customerDetails";

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

function buildDerivedDetails(customer: Customer) {
  const contacts: CustomerContactItem[] = [
    {
      id: `${customer.id}-primary-contact`,
      name: customer.primaryContact,
      role: "Primary Contact",
      phone: customer.phone,
      email: customer.email,
      preference: "Not recorded",
    },
  ];

  const notes: CustomerNoteItem[] = [
    {
      id: `${customer.id}-note-default`,
      body: "No account notes have been recorded yet.",
    },
  ];

  return { contacts, notes };
}

function OverviewSection({ customer }: { customer: Customer }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Summary</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="space-y-4 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
            <span>Customer profile is active and ready for service relationship tracking.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
            <span>
              {customer.propertyCount} propert{customer.propertyCount === 1 ? "y" : "ies"} linked
              — {customer.openJobs} open job{customer.openJobs === 1 ? "" : "s"} across the
              portfolio.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
            <span>Last activity recorded on {formatDate(customer.lastActivity)}.</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function PropertiesSection({ properties }: { properties: CustomerPropertyItem[] }) {
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

function JobsSection({ jobs }: { jobs: CustomerJobItem[] }) {
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

function TimelineSection({
  timelineItems,
  timelineError,
}: {
  timelineItems: TimelineEventItem[];
  timelineError?: string;
}) {
  if (timelineError) {
    return <ErrorState description={timelineError} />;
  }

  if (timelineItems.length === 0) {
    return (
      <EmptyState
        title="No timeline history yet"
        description="Customer events will appear here as scheduling, dispatch, and field updates happen."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Timeline</CardTitle>
      </CardHeader>

      <CardContent>
        <AtlasTimeline
          items={timelineItems.map((event) => ({
            ...event,
            icon: getTimelineIcon(event.source),
            sourceLabel: getSourceLabel(event.source),
          }))}
        />
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

interface CustomerDetailTabsProps {
  customer: Customer;
  properties: CustomerPropertyItem[];
  jobs: CustomerJobItem[];
  timelineItems: TimelineEventItem[];
  timelineError?: string;
}

export function CustomerDetailTabs({
  customer,
  properties,
  jobs,
  timelineItems,
  timelineError,
}: CustomerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<CustomerDetailTabKey>("overview");

  const { contacts, notes } = useMemo(
    () => buildDerivedDetails(customer),
    [customer],
  );

  return (
    <div className="space-y-6">
      <AtlasTabs items={tabs} value={activeTab} onChange={setActiveTab} sticky />

      {activeTab === "overview" ? <OverviewSection customer={customer} /> : null}

      {activeTab === "properties" ? <PropertiesSection properties={properties} /> : null}

      {activeTab === "jobs" ? <JobsSection jobs={jobs} /> : null}

      {activeTab === "contacts" ? <ContactsSection contacts={contacts} /> : null}

      {activeTab === "timeline" ? (
        <TimelineSection timelineItems={timelineItems} timelineError={timelineError} />
      ) : null}

      {activeTab === "notes" ? <NotesSection notes={notes} /> : null}
    </div>
  );
}
