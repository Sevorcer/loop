import { describe, expect, it } from "vitest";

import {
  STREET_VIEW_IMAGE_SIZE,
  STREET_VIEW_RADIUS_METERS,
  buildAerialEmbedUrl,
  buildStreetViewImageUrl,
  buildStreetViewMetadataUrl,
  headingDegrees,
  parseStreetViewMetadata,
  resolveStreetViewTarget,
  streetViewSizeIsValid,
} from "@/features/properties/utils/propertyImagery";

const PROPERTY = { latitude: 47.6, longitude: -122.33 };
const CAMERA = { latitude: 47.601, longitude: -122.33 };

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("property street-view URLs", () => {
  it("builds a valid photo URL aimed at the property", () => {
    const url = buildStreetViewImageUrl({
      apiKey: "test-key",
      locationQuery: "47.6,-122.33",
      property: PROPERTY,
      panoId: "pano-ok",
      camera: CAMERA,
    });
    const params = paramsOf(url);

    expect(url.startsWith("https://maps.googleapis.com/maps/api/streetview?")).toBe(true);
    expect(params.get("size")).toBe(STREET_VIEW_IMAGE_SIZE);
    expect(streetViewSizeIsValid(params.get("size") ?? "")).toBe(true);
    expect(params.get("return_error_code")).toBe("true");
    expect(params.get("pano")).toBe("pano-ok");
    expect(params.get("source")).toBeNull();
    expect(params.get("key")).toBe("test-key");
    expect(params.get("location")).toBeNull();

    const heading = Number(params.get("heading"));
    expect(heading).toBeGreaterThan(170);
    expect(heading).toBeLessThan(190);
    expect(params.get("heading")).not.toBe("210");
  });

  it("does not repeat the oversized outdoor request that returned the gray tile", () => {
    const url = buildStreetViewImageUrl({
      apiKey: "test-key",
      locationQuery: "47.6,-122.33",
      property: PROPERTY,
    });
    const params = paramsOf(url);

    expect(params.get("size")).not.toBe("1200x720");
    expect(params.get("source")).toBeNull();
    expect(params.get("heading")).toBeNull();
    expect(params.get("radius")).toBe(String(STREET_VIEW_RADIUS_METERS));
    expect(params.get("return_error_code")).toBe("true");
    expect(params.get("location")).toBe("47.6,-122.33");
    expect(streetViewSizeIsValid("1200x720")).toBe(false);
  });

  it("accepts numeric strings from the database and falls back to an address", () => {
    expect(
      resolveStreetViewTarget({
        latitude: "47.610000",
        longitude: "-122.330000",
      })?.locationQuery,
    ).toBe("47.61,-122.33");

    expect(
      resolveStreetViewTarget({
        latitude: null,
        longitude: null,
        address: "100 Test Street, Springfield, WA",
      }),
    ).toEqual({
      locationQuery: "100 Test Street, Springfield, WA",
      point: null,
    });

    expect(resolveStreetViewTarget({ latitude: "nope", longitude: "nope" })).toBeNull();
  });

  it("prefers a place id when one is stored", () => {
    const target = resolveStreetViewTarget({
      latitude: 47.6,
      longitude: -122.33,
      placeId: "ChIJtestPlaceId",
    });
    expect(target?.locationQuery).toBe("place_id:ChIJtestPlaceId");
    expect(target?.point).toEqual(PROPERTY);
  });

  it("aims the camera south when the panorama is north of the property", () => {
    expect(headingDegrees(CAMERA, PROPERTY)).toBeGreaterThan(170);
    expect(headingDegrees(CAMERA, PROPERTY)).toBeLessThan(190);
  });

  it("parses a confirmed panorama, a real miss, and a denied key", () => {
    expect(
      parseStreetViewMetadata({
        status: "OK",
        pano_id: "pano-1",
        location: { lat: 47.601, lng: -122.33 },
      }),
    ).toEqual({
      status: "available",
      panoId: "pano-1",
      camera: CAMERA,
    });

    expect(parseStreetViewMetadata({ status: "ZERO_RESULTS" }).status).toBe("missing");
    expect(parseStreetViewMetadata({ status: "REQUEST_DENIED" }).status).toBe("denied");
    expect(parseStreetViewMetadata(null).status).toBe("unknown");
  });

  it("asks metadata for outdoor coverage before the wider default search", () => {
    const outdoor = paramsOf(
      buildStreetViewMetadataUrl("test-key", "47.6,-122.33", "outdoor"),
    );
    const fallback = paramsOf(
      buildStreetViewMetadataUrl("test-key", "47.6,-122.33", "default"),
    );

    expect(outdoor.get("source")).toBe("outdoor");
    expect(outdoor.get("radius")).toBe(String(STREET_VIEW_RADIUS_METERS));
    expect(fallback.get("source")).toBeNull();
    expect(fallback.get("radius")).toBe(String(STREET_VIEW_RADIUS_METERS));
  });

  it("builds the satellite embed from the property point", () => {
    const params = paramsOf(buildAerialEmbedUrl("test-key", PROPERTY));
    expect(params.get("maptype")).toBe("satellite");
    expect(params.get("center")).toBe("47.6,-122.33");
    expect(params.get("zoom")).toBe("19");
    expect(params.get("key")).toBe("test-key");
  });
});
