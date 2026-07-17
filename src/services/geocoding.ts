/**
 * Server-only geocoding service.
 *
 * Uses the Google Maps Geocoding API to resolve a human-readable address into
 * geographic coordinates and enriched location metadata.
 *
 * Required environment variable (server-side only — never expose to the browser):
 *   GOOGLE_MAPS_GEOCODING_API_KEY
 *
 * @see https://developers.google.com/maps/documentation/geocoding
 */

import "server-only";

import type { PropertyLocation } from "@/features/properties/types/property";

const GEOCODING_API_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";

export type GeocodeResult =
  | { success: true; location: PropertyLocation }
  | { success: false; error: string };

/**
 * Geocode a street address into coordinates and enriched location metadata.
 *
 * @param address - Full address string, e.g. "245 Maple Ave, Seattle, WA"
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error:
        "GOOGLE_MAPS_GEOCODING_API_KEY is not set. Geocoding is unavailable.",
    };
  }

  const url = new URL(GEOCODING_API_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  let response: Response;

  try {
    // Use no-store so every geocoding call fetches fresh data.
    // Geocoding is triggered by address changes — stale cached results could
    // silently return wrong coordinates for a newly entered address.
    response = await fetch(url.toString(), { cache: "no-store" });
  } catch (err) {
    return {
      success: false,
      error: `Geocoding network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `Geocoding API returned HTTP ${response.status}`,
    };
  }

  const data = (await response.json()) as {
    status: string;
    results: Array<{
      place_id: string;
      formatted_address: string;
      geometry: {
        location: { lat: number; lng: number };
      };
    }>;
    error_message?: string;
  };

  if (data.status !== "OK" || data.results.length === 0) {
    return {
      success: false,
      error: data.error_message ?? `Geocoding returned status: ${data.status}`,
    };
  }

  const result = data.results[0];

  return {
    success: true,
    location: {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    },
  };
}
