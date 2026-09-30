import { CalendarClock, Heart, Mail, Pencil, Phone, Users } from "lucide-react";
import Link from "next/link";

import { PermissionGuard, PhoneLink, StatusBadge } from "@/components/atlas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { formatDateOnly } from "@/lib/dates";

import { CustomerDeleteButton } from "../components/CustomerDeleteButton";
import { CustomerDetailTabs } from "../components/CustomerDetailTabs";
import { CustomerMobileActionBar } from "../components/CustomerMobileActionBar";
import type { Customer } from "../types/customer";
import type {
  CustomerInstalledSystemItem,
  CustomerJobItem,
  CustomerPropertyItem,
} from "../types/customerDetails";
import type { TimelineEventItem } from "@/lib/timeline";

interface CustomerDetailScreenProps {
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

function formatDate(value: string) {
  return formatDateOnly(value);
}

export function CustomerDetailScreen({
  customer,
  properties,
  jobs,
  installedSystems,
  timelineItems,
  timelineError,
  systemsError,
  initialTab,
  initialPropertyId,
}: CustomerDetailScreenProps) {
  const statusVariant =
    customer.status === "Active"
      ? "success"
      : customer.status === "Prospect"
        ? "warning"
        : "neutral";

  return (
    // F14: bottom padding keeps page content clear of the sticky mobile
    // action bar (rendered only on small screens).
    <div className="space-y-6 pb-28 md:pb-0">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {customer.name}
                </h1>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {customer.email}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    <PhoneLink
                      phone={customer.phone}
                      className="text-blue-400 hover:text-blue-300 hover:underline"
                    />
                  </span>
                  {customer.phone2 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      <PhoneLink
                        phone={customer.phone2}
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      />
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge variant={statusVariant}>{customer.status}</StatusBadge>

              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                Primary Contact: {customer.primaryContact}
              </span>

              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                City: {customer.city}
              </span>
              {customer.street ? (
                <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                  {customer.street}
                  {customer.zip ? ` ${customer.zip}` : ""}
                </span>
              ) : customer.zip ? (
                <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                  ZIP: {customer.zip}
                </span>
              ) : null}
            </div>

            {customer.notes ? (
              <div className="rounded-xl border border-default bg-surface-elevated/50 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Intake Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-primary">{customer.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-4">
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[360px]">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Account Health
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-green-500" />
                    <p className="text-lg font-semibold">
                      {customer.status === "Inactive" ? "Needs Review" : "Good"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Last Activity
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatDate(customer.lastActivity)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Properties
                  </p>
                  <p className="mt-2 text-lg font-semibold">{customer.propertyCount}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Installed Systems
                  </p>
                  <p className="mt-2 text-lg font-semibold">{installedSystems.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Jobs
                  </p>
                  <p className="mt-2 text-lg font-semibold">{jobs.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PermissionGuard table="customers" action="update">
                <Link href={ROUTE_BUILDERS.CUSTOMER_EDIT(customer.id)}>
                  <Button variant="outline" size="sm" className="min-h-[44px] gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </Link>
              </PermissionGuard>

              <PermissionGuard table="jobs" action="insert">
                <Link href={ROUTE_BUILDERS.JOB_NEW({ customerId: customer.id })}>
                  <Button variant="outline" size="sm" className="min-h-[44px] gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Create Job
                  </Button>
                </Link>
              </PermissionGuard>

              <PermissionGuard table="customers" action="delete">
                <CustomerDeleteButton
                  customerId={customer.id}
                  customerName={customer.name}
                />
              </PermissionGuard>
            </div>
          </div>
        </div>
      </div>

      <CustomerDetailTabs
        customer={customer}
        properties={properties}
        jobs={jobs}
        installedSystems={installedSystems}
        timelineItems={timelineItems}
        timelineError={timelineError}
        systemsError={systemsError}
        initialTab={initialTab}
        initialPropertyId={initialPropertyId}
      />

      {/* F14: sticky phone action bar (Call / Directions). */}
      <CustomerMobileActionBar customer={customer} />
    </div>
  );
}
