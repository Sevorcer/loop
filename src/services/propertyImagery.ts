import "server-only";

import {
  buildAerialEmbedUrl,
  buildStreetViewImageUrl,
  buildStreetViewMetadataUrl,
  parseStreetViewMetadata,
  resolveStreetViewTarget,
  type StreetViewMetadata,
} from "@/features/properties/utils/propertyImagery";

export interface PropertyMapImageryInput {
  latitude?: unknown;
  longitude?: unknown;
  placeId?: string | null;
  address?: string | null;
}

export interface PropertyMapImagery {
  streetImageSrc: string | null;
  aerialSrc: string | null;
  /** True when a browser-facing Maps key is configured. */
  mapsConfigured: boolean;
}

const METADATA_REVALIDATE_SECONDS = 60 * 60 * 24;

/**
 * Browser image and embed URLs include the key, matching the existing
 * property card. The geocoding key stays server-only and is not reused here.
 */
function mapsApiKey(): string | null {
  const key = (process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_EMBED_API_KEY ?? "").trim();
  return key.length > 0 ? key : null;
}

async function readStreetViewMetadata(url: string): Promise<StreetViewMetadata> {
  try {
    const response = await fetch(url, { next: { revalidate: METADATA_REVALIDATE_SECONDS } });
    if (!response.ok) {
      return { status: "unknown", panoId: null, camera: null };
    }
    return parseStreetViewMetadata(await response.json());
  } catch {
    return { status: "unknown", panoId: null, camera: null };
  }
}

/**
 * Resolves the property card's street and aerial URLs.
 *
 * Outdoor metadata is preferred. When that search has no panorama, a second
 * lookup uses Street View's default sources so an untagged photo is not
 * dropped. A confirmed miss does not produce an image URL — that URL would
 * be the gray "no imagery" tile. A metadata outage still produces a
 * best-effort image URL that 404s instead of that tile.
 */
export async function resolvePropertyMapImagery(
  input: PropertyMapImageryInput,
): Promise<PropertyMapImagery> {
  const apiKey = mapsApiKey();
  const target = resolveStreetViewTarget(input);
  if (!apiKey || !target) {
    return {
      streetImageSrc: null,
      aerialSrc: null,
      mapsConfigured: Boolean(apiKey),
    };
  }

  const aerialSrc = target.point ? buildAerialEmbedUrl(apiKey, target.point) : null;
  const outdoor = await readStreetViewMetadata(
    buildStreetViewMetadataUrl(apiKey, target.locationQuery, "outdoor"),
  );
  const metadata =
    outdoor.status === "missing"
      ? await readStreetViewMetadata(
          buildStreetViewMetadataUrl(apiKey, target.locationQuery, "default"),
        )
      : outdoor;

  if (metadata.status === "missing" || metadata.status === "denied") {
    return { streetImageSrc: null, aerialSrc, mapsConfigured: true };
  }

  return {
    streetImageSrc: buildStreetViewImageUrl({
      apiKey,
      locationQuery: target.locationQuery,
      property: target.point,
      panoId: metadata.status === "available" ? metadata.panoId : null,
      camera: metadata.status === "available" ? metadata.camera : null,
    }),
    aerialSrc,
    mapsConfigured: true,
  };
}
