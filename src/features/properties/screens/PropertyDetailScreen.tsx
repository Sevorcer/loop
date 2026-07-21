import Link from "next/link";
import {
  Building2,
  Heart,
  MapPin,
} from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTE_BUILDERS } from "@/lib/routes";
import type { Customer } from "@/features/customers/types/customer";
import type { CustomerPropertyItem } from "@/features/customers/types/customerDetails";
import type { Property } from "../types/property";
import { MapViewCard } from "../components/MapViewCard";
import { PropertyDetailTabs } from "../components/PropertyDetailTabs";
import { formatPropertyAddress } from "../utils/formatPropertyAddress";

interface PropertyDetailScreenProps {
  property: Property;
  customer?: Customer | null;
  customerProperties?: CustomerPropertyItem[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}


export function PropertyDetailScreen({
  property,
  customer = null,
  customerProperties = [],
}: PropertyDetailScreenProps) {
  const statusVariant =
    property.status === "Active"
      ? "success"
      : property.status === "Pending"
        ? "warning"
        : "neutral";

  const activeSystems = property.status === "Inactive" ? 0 : 1;

  const { location } = property;

  const rawAddress = formatPropertyAddress(property);

  const navigationUrl = location
    ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}`;

  // Read the Google Maps key server-side so it never reaches the browser
  // bundle as executable code. Support the existing embed-specific name for
  // backward compatibility while allowing a general-purpose key name for the
  // mixed static-image + embed experience.
  const mapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_EMBED_API_KEY;

  const streetImageSrc =
    mapsApiKey && location
      ? `https://maps.googleapis.com/maps/api/streetview?size=1200x720&location=${location.latitude},${location.longitude}&heading=210&pitch=0&fov=90&source=outdoor&key=${mapsApiKey}`
      : null;

  const aerialSrc =
    mapsApiKey && location
      ? `https://www.google.com/maps/embed/v1/view?key=${mapsApiKey}&center=${location.latitude},${location.longitude}&zoom=19&maptype=satellite`
      : null;

  const hasAnyPropertyAddressField = [property.address, property.city].some((value) =>
    Boolean(value?.trim())
  );

  const arrivalAddress = hasAnyPropertyAddressField
    ? rawAddress
    : location?.formattedAddress || rawAddress;

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

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{rawAddress}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge variant={statusVariant}>{property.status}</StatusBadge>

              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                {property.type}
              </span>

              {property.customerId ? (
                <Link
                  href={ROUTE_BUILDERS.CUSTOMER_DETAIL(property.customerId)}
                  className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                >
                  Customer: {property.customer}
                </Link>
              ) : (
                <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                  Customer: {property.customer}
                </span>
              )}
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[360px]">
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
        </div>
      </div>

      {/* Map card — static street-side image primary, aerial secondary */}
      <MapViewCard
        streetImageSrc={streetImageSrc}
        aerialSrc={aerialSrc}
        navigationUrl={navigationUrl}
        arrivalAddress={arrivalAddress}
        propertyName={property.name}
      />

      {/* Property detail tabs — equipment, jobs, timeline, documents, and more */}
      <PropertyDetailTabs
        property={property}
        customer={customer}
        customerProperties={customerProperties}
      />
    </div>
  );
}
