import { Heart, Mail, Pencil, Phone, Users } from "lucide-react";
import Link from "next/link";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { CustomerDeleteButton } from "../components/CustomerDeleteButton";
import { CustomerDetailTabs } from "../components/CustomerDetailTabs";
import type { Customer } from "../types/customer";
import type { CustomerJobItem, CustomerPropertyItem } from "../types/customerDetails";

interface CustomerDetailScreenProps {
  customer: Customer;
  properties: CustomerPropertyItem[];
  jobs: CustomerJobItem[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function CustomerDetailScreen({
  customer,
  properties,
  jobs,
}: CustomerDetailScreenProps) {
  const statusVariant =
    customer.status === "Active"
      ? "success"
      : customer.status === "Prospect"
        ? "warning"
        : "neutral";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {customer.name}
                </h1>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {customer.email}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    {customer.phone}
                  </span>
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
            </div>
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
                    Open Jobs
                  </p>
                  <p className="mt-2 text-lg font-semibold">{customer.openJobs}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-2">
              <PermissionGuard table="customers" action="update">
                <Link href={ROUTE_BUILDERS.CUSTOMER_EDIT(customer.id)}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit
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

      <CustomerDetailTabs customer={customer} properties={properties} jobs={jobs} />
    </div>
  );
}
