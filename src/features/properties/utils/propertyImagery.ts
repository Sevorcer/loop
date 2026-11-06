/**
 * Street View request building for the property page.
 *
 * The property card used to request a 1200×720 image with `source=outdoor`
 * and a fixed heading of 210. The Static API only serves images up to 640px
 * on a side, `source=outdoor` drops panoramas Google has not tagged, and the
 * default 50m search misses houses set back from the road. Any of those
 * misses comes back as Google's gray "Sorry, we have no imagery here" tile,
 * which the page rendered as the property photo.
 *
 * These helpers keep the request inside the API limits, search a wider
 * radius, and only emit an image URL after metadata says a panorama exists
 * — or as a best-effort URL that asks Google to return 404 instead of that
 * gray tile (`return_error_code=true`).
 */

/** Street View Static API maximum edge length, in pixels. */
export const STREET_VIEW_MAX_EDGE_PX = 640;

/** 5:3 frame that fits the property card and stays inside the 640px limit. */
export const STREET_VIEW_IMAGE_SIZE = "640x384";

/**
 * Search radius in meters. The API default is 50, which misses a house whose
 * rooftop coordinate sits farther than that from the nearest panorama. The
 * API still returns the closest panorama inside the radius, so a wider
 * radius does not change the photo when a closer one exists.
 */
export const STREET_VIEW_RADIUS_METERS = 250;

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/;

export interface StreetViewPoint {
  latitude: number;
  longitude: number;
}

export type StreetViewCoverage = "available" | "missing" | "denied" | "unknown";

export interface StreetViewMetadata {
  status: StreetViewCoverage;
  panoId: string | null;
  camera: StreetViewPoint | null;
}

export interface PropertyImageryTarget {
  /** Value for the Street View `location` parameter. */
  locationQuery: string;
  /** Property point used to aim the camera and to center aerial imagery. */
  point: StreetViewPoint | null;
}

export function coerceCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function streetViewPoint(latitude: unknown, longitude: unknown): StreetViewPoint | null {
  const lat = coerceCoordinate(latitude);
  const lng = coerceCoordinate(longitude);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Prefer a place id, then coordinates, then the written address.
 * Place ids are unused in current rows; coordinates cover the geocoded
 * properties, and the address still lets Street View search the rest.
 */
export function resolveStreetViewTarget(input: {
  latitude?: unknown;
  longitude?: unknown;
  placeId?: string | null;
  address?: string | null;
}): PropertyImageryTarget | null {
  const point = streetViewPoint(input.latitude, input.longitude);
  const placeId = input.placeId?.trim() ?? "";
  if (PLACE_ID_PATTERN.test(placeId)) {
    return { locationQuery: `place_id:${placeId}`, point };
  }
  if (point) {
    return { locationQuery: `${point.latitude},${point.longitude}`, point };
  }
  const address = input.address?.trim() ?? "";
  if (!address) return null;
  return { locationQuery: address, point: null };
}

/** Compass heading from the panorama camera toward the property, 0–360. */
export function headingDegrees(from: StreetViewPoint, to: StreetViewPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function parseStreetViewMetadata(payload: unknown): StreetViewMetadata {
  const empty = (status: StreetViewCoverage): StreetViewMetadata => ({
    status,
    panoId: null,
    camera: null,
  });

  if (!payload || typeof payload !== "object") return empty("unknown");
  const record = payload as Record<string, unknown>;
  const rawStatus = typeof record.status === "string" ? record.status : "";
  const panoId =
    typeof record.pano_id === "string" && record.pano_id.trim()
      ? record.pano_id.trim()
      : null;

  let camera: StreetViewPoint | null = null;
  if (record.location && typeof record.location === "object") {
    const location = record.location as Record<string, unknown>;
    camera = streetViewPoint(location.lat, location.lng);
  }

  if (rawStatus === "OK") {
    return { status: "available", panoId, camera };
  }
  if (rawStatus === "ZERO_RESULTS" || rawStatus === "NOT_FOUND") {
    return empty("missing");
  }
  if (rawStatus === "REQUEST_DENIED" || rawStatus === "INVALID_REQUEST") {
    return empty("denied");
  }
  return empty("unknown");
}

export function buildStreetViewMetadataUrl(
  apiKey: string,
  locationQuery: string,
  source: "outdoor" | "default",
): string {
  const params = new URLSearchParams();
  params.set("location", locationQuery);
  params.set("radius", String(STREET_VIEW_RADIUS_METERS));
  if (source === "outdoor") params.set("source", "outdoor");
  params.set("key", apiKey);
  return `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`;
}

export function buildStreetViewImageUrl(input: {
  apiKey: string;
  locationQuery: string;
  property?: StreetViewPoint | null;
  panoId?: string | null;
  camera?: StreetViewPoint | null;
}): string {
  const params = new URLSearchParams();
  params.set("size", STREET_VIEW_IMAGE_SIZE);
  params.set("return_error_code", "true");

  const panoId = input.panoId?.trim() ?? "";
  if (panoId) {
    params.set("pano", panoId);
  } else {
    params.set("location", input.locationQuery);
    params.set("radius", String(STREET_VIEW_RADIUS_METERS));
  }

  if (input.camera && input.property) {
    params.set("heading", headingDegrees(input.camera, input.property).toFixed(2));
  }

  params.set("key", input.apiKey);
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

export function buildAerialEmbedUrl(apiKey: string, point: StreetViewPoint): string {
  const params = new URLSearchParams();
  params.set("key", apiKey);
  params.set("center", `${point.latitude},${point.longitude}`);
  params.set("zoom", "19");
  params.set("maptype", "satellite");
  return `https://www.google.com/maps/embed/v1/view?${params.toString()}`;
}

/** True when a size string stays inside the Static API edge limit. */
export function streetViewSizeIsValid(size: string): boolean {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return false;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 && width <= STREET_VIEW_MAX_EDGE_PX && height <= STREET_VIEW_MAX_EDGE_PX;
}
