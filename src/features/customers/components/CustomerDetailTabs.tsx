"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import {
  AtlasTabs,
  AtlasTimeline,
  EmptyState,
  StatusBadge,
} from "@/components/atlas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Customer } from "../types/customer";
import type { CustomerDetails } from "../types/customerDetails";

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

function getCustomerDetails(customer: Customer): CustomerDetails {
  return {
    customerId: customer.id,
    accountSummary: [
      "Customer profile is active and ready for deeper service relationship tracking.",
      "No additional account intelligence has been recorded yet.",
    ],
    properties: [],
    jobs: [],
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

function PropertiesSection({ details }: { details: CustomerDetails }) {
  if (details.properties.length === 0) {
    return (
      <EmptyState
        title="No linked properties yet"
        description="Properties connected to this customer account will appear here."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {details.properties.map((property) => (
        <Link key={property.id} href={`/properties/${property.id}`} className="block">
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

function JobsSection({ details }: { details: CustomerDetails }) {
  if (details.jobs.length === 0) {
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
        {details.jobs.map((job) => (
          <div key={job.id} className="rounded-xl border bg-muted/20 p-4">
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
        ))}
      </CardContent>
    </Card>
  );
}

function ContactsSection({ details }: { details: CustomerDetails }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {details.contacts.map((contact) => (
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

function TimelineSection({ details }: { details: CustomerDetails }) {
  const timelineItems = useMemo(
    () =>
      details.timeline.map((event) => ({
        id: event.id,
        title: event.title,
        date: formatDate(event.date),
        description: event.description,
      })),
    [details.timeline]
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

function NotesSection({ details }: { details: CustomerDetails }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Notes</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {details.notes.map((note) => (
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
  const [activeTab, setActiveTab] =
    useState<CustomerDetailTabKey>("overview");

  const details = useMemo(() => getCustomerDetails(customer), [customer]);

  return (
    <div className="space-y-6">
      <AtlasTabs
        items={tabs}
        value={activeTab}
        onChange={setActiveTab}
        sticky
      />

      {activeTab === "overview" ? (
        <OverviewSection accountSummary={details.accountSummary} />
      ) : null}

      {activeTab === "properties" ? (
        <PropertiesSection details={details} />
      ) : null}

      {activeTab === "jobs" ? <JobsSection details={details} /> : null}

      {activeTab === "contacts" ? (
        <ContactsSection details={details} />
      ) : null}

      {activeTab === "timeline" ? (
        <TimelineSection details={details} />
      ) : null}

      {activeTab === "notes" ? <NotesSection details={details} /> : null}
    </div>
  );
}