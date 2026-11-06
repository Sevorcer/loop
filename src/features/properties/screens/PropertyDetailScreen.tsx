import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Heart,
  MapPin,
  Pencil,
} from "lucide-react";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { joinAddressParts } from "@/lib/address";
import { ROUTE_BUILDERS } from "@/lib/routes";
import type { Job } from "@/features/jobs/types/job";
import type { InstalledSystem } from "@/features/installed-systems/types/installedSystem";
import type { TimelineEventItem } from "@/lib/timeline";
import type { Customer } from "@/features/customers/types/customer";
import type { CustomerPropertyItem } from "@/features/customers/types/customerDetails";
import type { Property } from "../types/property";
import { resolvePropertyMapImagery } from "@/services/propertyImagery";
import { MapViewCard } from "../components/MapViewCard";
import { PropertyDeleteButton } from "../components/PropertyDeleteButton";
import { PropertyDetailTabs } from "../components/PropertyDetailTabs";
import { formatPropertyAddress } from "../utils/formatPropertyAddress";
import { formatDateOnly } from "@/lib/dates";

interface PropertyDetailScreenProps {
  property: Property;
  customer?: Customer | null;
  customerProperties?: CustomerPropertyItem[];
  jobs?: Job[];
  installedSystems?: InstalledSystem[];
  timelineItems: TimelineEventItem[];
  timelineError?: string;
}

function formatDate(value: string) {
  return formatDateOnly(value);
}


export async function PropertyDetailScreen({
  property,
  customer = null,
  customerProperties = [],
  jobs = [],
  installedSystems = [],
  timelineItems,
  timelineError,
}: PropertyDetailScreenProps) {
  const statusVariant =
    property.status === "Active"
      ? "success"
      : property.status === "Pending"
        ? "warning"
        : "neutral";

  const activeSystems = installedSystems?.length ?? 0;

  const { location } = property;

  const addressLine =
    formatPropertyAddress(property) || joinAddressParts([location?.formattedAddress]);

  const navigationUrl = location
    ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
    : addressLine
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`
      : "";

  const appleMapsUrl = location
    ? `https://maps.apple.com/?q=${location.latitude},${location.longitude}`
    : addressLine
      ? `https://maps.apple.com/?q=${encodeURIComponent(addressLine)}`
      : "";

  // Imagery URLs are built on the server. A confirmed Street View panorama
  // becomes the street photo; a miss falls through to the satellite embed
  // instead of Google's gray "no imagery" tile.
  const imagery = await resolvePropertyMapImagery({
    latitude: location?.latitude,
    longitude: location?.longitude,
    placeId: location?.placeId,
    address: addressLine,
  });

  const propertyType = property.type?.trim() ?? "";
  const customerName = property.customer?.trim() ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {property.name}
                </h1>

                {addressLine ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{addressLine}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {property.status?.trim() ? (
                <StatusBadge variant={statusVariant}>{property.status}</StatusBadge>
              ) : null}

              {propertyType ? (
                <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                  {propertyType}
                </span>
              ) : null}

              {customerName && property.customerId ? (
                <Link
                  href={ROUTE_BUILDERS.CUSTOMER_DETAIL(property.customerId)}
                  className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                >
                  Customer: {customerName}
                </Link>
              ) : customerName ? (
                <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                  Customer: {customerName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-auto lg:min-w-[360px]">
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Home Health
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-green-500" />
                    <p className="text-lg font-semibold">
                      {property.status === "Inactive" ? "Needs Review" : "Good"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Last Visit
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatDate(property.lastVisit)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Open Jobs
                  </p>
                  <p className="mt-2 text-lg font-semibold">{property.openJobs}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Active Systems
                  </p>
                  <p className="mt-2 text-lg font-semibold">{activeSystems}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-2">
              <PermissionGuard table="properties" action="update">
                <Link href={ROUTE_BUILDERS.PROPERTY_EDIT(property.id)}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </Link>
              </PermissionGuard>

              <PermissionGuard table="jobs" action="insert">
                <Link
                  href={ROUTE_BUILDERS.JOB_NEW({
                    customerId: property.customerId ?? undefined,
                    propertyId: property.id,
                  })}
                >
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Schedule Appointment
                  </Button>
                </Link>
              </PermissionGuard>

              <PermissionGuard table="properties" action="delete">
                <PropertyDeleteButton
                  propertyId={property.id}
                  propertyName={property.name}
                />
              </PermissionGuard>
            </div>
          </div>
        </div>
      </div>

      {/* Map card — static street-side image primary, aerial secondary */}
      <MapViewCard
        streetImageSrc={imagery.streetImageSrc}
        aerialSrc={imagery.aerialSrc}
        mapsConfigured={imagery.mapsConfigured}
        navigationUrl={navigationUrl}
        appleMapsUrl={appleMapsUrl}
        arrivalAddress={addressLine}
        propertyName={property.name}
      />

      {/* Property detail tabs — equipment, jobs, timeline, documents, and more */}
      <PropertyDetailTabs
        property={property}
        customer={customer}
        customerProperties={customerProperties}
        jobs={jobs}
        installedSystems={installedSystems}
        timelineItems={timelineItems}
        timelineError={timelineError}
      />
    </div>
  );
}
