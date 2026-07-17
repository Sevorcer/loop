import {
  Building2,
  ClipboardList,
  Heart,
  MapPin,
  Navigation,
  Wrench,
} from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Property } from "../types/property";

interface PropertyDetailScreenProps {
  property: Property;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

const beforeYouGoItems = [
  "Confirm property access and parking before arrival.",
  "Review latest visit notes and open job context.",
  "Verify equipment match before starting work.",
];

const homeIntelligenceItems = [
  "Outdoor equipment located on the west side of the property.",
  "Preferred customer contact is text message before arrival.",
  "Filter size noted for future service preparation.",
];

const recentJobStories = (lastVisit: string) => [
  { date: formatDate(lastVisit), title: "Annual maintenance completed" },
  { date: "2/10/2026", title: "Warranty follow-up and system adjustment" },
  { date: "11/18/2025", title: "Initial startup and commissioning" },
];

export function PropertyDetailScreen({ property }: PropertyDetailScreenProps) {
  const statusVariant =
    property.status === "Active"
      ? "success"
      : property.status === "Pending"
        ? "warning"
        : "neutral";

  const activeSystems = property.status === "Inactive" ? 0 : 1;

  const { location } = property;

  const navigationUrl = location
    ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.address}, ${property.city}`)}`;

  const embedApiKey = process.env.GOOGLE_MAPS_EMBED_API_KEY;

  const streetViewSrc =
    embedApiKey && location
      ? `https://www.google.com/maps/embed/v1/streetview?key=${embedApiKey}&location=${location.latitude},${location.longitude}&heading=210&pitch=0&fov=90`
      : null;

  const arrivalAddress =
    location?.formattedAddress ?? `${property.address}, ${property.city}`;

  const stories = recentJobStories(property.lastVisit);

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
                  <span>{property.address}, {property.city}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge variant={statusVariant}>{property.status}</StatusBadge>

              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                {property.type}
              </span>

              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                Customer: {property.customer}
              </span>
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

      {/* Street View */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Street View</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Interactive curbside view before arrival. Pan and explore the surrounding street.
            </p>
          </div>

          <a
            href={navigationUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium",
              "bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Navigation className="h-4 w-4" />
            Navigate
          </a>
        </CardHeader>

        <CardContent className="space-y-4">
          {streetViewSrc ? (
            <iframe
              title={`Street view of ${property.name}`}
              src={streetViewSrc}
              className="h-72 w-full rounded-xl border"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-muted/30 via-muted/10 to-background">
              <div className="absolute inset-0 opacity-30">
                <div className="h-full w-full bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
              </div>

              <div className="relative flex h-72 flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border bg-background/60">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>

                <h3 className="text-lg font-semibold">Street View unavailable</h3>

                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Set <code className="font-mono">GOOGLE_MAPS_EMBED_API_KEY</code> to
                  enable interactive Street View.
                </p>

                <div className="mt-6 rounded-full border bg-background/60 px-4 py-2 text-sm text-muted-foreground">
                  {arrivalAddress}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl border bg-muted/10 p-4">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Arrival Address</p>
              <p className="text-sm text-muted-foreground">{arrivalAddress}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content grid */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Job Stories</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {stories.map((story) => (
                <div
                  key={`${story.date}-${story.title}`}
                  className="flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{story.title}</p>
                    <p className="text-sm text-muted-foreground">{story.date}</p>
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
              <CardTitle>Active Systems</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{property.primarySystem}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Primary installed equipment for this property.
                    </p>
                  </div>

                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
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
    </div>
  );
}
