"use client";

import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MapView = "street" | "aerial";

interface MapViewCardProps {
  /** Pre-built Maps Embed API streetview src, or null if unavailable. */
  streetViewSrc: string | null;
  /** Pre-built Maps Embed API satellite view src, or null if unavailable. */
  aerialSrc: string | null;
  /** Google Maps navigation URL for the Navigate button. */
  navigationUrl: string;
  /** Human-readable arrival address shown in the address row. */
  arrivalAddress: string;
  /** Property name used for iframe accessibility title. */
  propertyName: string;
}

/**
 * Two-view map card for the property detail page.
 *
 * Street View is the default — gives techs curbside context before arrival.
 * Aerial is the secondary — gives a roof/lot overview.
 *
 * All embed URLs are computed server-side and passed in as props so that
 * API keys never reach the browser JavaScript bundle.
 */
export function MapViewCard({
  streetViewSrc,
  aerialSrc,
  navigationUrl,
  arrivalAddress,
  propertyName,
}: MapViewCardProps) {
  const [activeView, setActiveView] = useState<MapView>("street");

  const hasStreetView = streetViewSrc !== null;
  const hasAerial = aerialSrc !== null;
  const hasAnyEmbed = hasStreetView || hasAerial;

  const activeSrc =
    activeView === "street" ? streetViewSrc : aerialSrc;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-4">
          <div>
            <CardTitle>Property View</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeView === "street"
                ? "Interactive curbside view — pan and explore the street."
                : "Satellite overview — roof, lot, and surroundings."}
            </p>
          </div>

          {hasAnyEmbed && (
            <div className="flex items-center rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveView("street")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  activeView === "street"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Street
              </button>
              <button
                type="button"
                onClick={() => setActiveView("aerial")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  activeView === "aerial"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Aerial
              </button>
            </div>
          )}
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
        {activeSrc ? (
          <iframe
            key={activeSrc}
            title={`${activeView === "street" ? "Street view" : "Aerial view"} of ${propertyName}`}
            src={activeSrc}
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

              <h3 className="text-lg font-semibold">
                {activeView === "street" ? "Street View" : "Aerial View"} unavailable
              </h3>

              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Set{" "}
                <code className="font-mono">GOOGLE_MAPS_EMBED_API_KEY</code>{" "}
                to enable map views.
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
  );
}
