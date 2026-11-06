import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolvePropertyMapImagery } from "@/services/propertyImagery";

const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;
const originalEmbedKey = process.env.GOOGLE_MAPS_EMBED_API_KEY;

function metadataResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  if (originalMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
  if (originalEmbedKey === undefined) delete process.env.GOOGLE_MAPS_EMBED_API_KEY;
  else process.env.GOOGLE_MAPS_EMBED_API_KEY = originalEmbedKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolvePropertyMapImagery", () => {
  it("returns a street photo URL when metadata confirms a panorama", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    delete process.env.GOOGLE_MAPS_EMBED_API_KEY;
    const fetchMock = vi.fn(async (url: string) => {
      const source = new URL(String(url)).searchParams.get("source");
      expect(source).toBe("outdoor");
      return metadataResponse({
        status: "OK",
        pano_id: "pano-confirmed",
        location: { lat: 47.601, lng: -122.33 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const imagery = await resolvePropertyMapImagery({
      latitude: "47.6",
      longitude: "-122.33",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(imagery.mapsConfigured).toBe(true);
    expect(imagery.aerialSrc).toContain("maptype=satellite");
    const street = new URL(imagery.streetImageSrc ?? "");
    expect(street.searchParams.get("pano")).toBe("pano-confirmed");
    expect(street.searchParams.get("size")).toBe("640x384");
    expect(street.searchParams.get("return_error_code")).toBe("true");
    expect(street.searchParams.get("source")).toBeNull();
    expect(street.searchParams.get("key")).toBe("test-key");
  });

  it("does not hand the browser a street URL when imagery is missing", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn(async (url: string) => {
      const source = new URL(String(url)).searchParams.get("source");
      if (source === "outdoor") return metadataResponse({ status: "ZERO_RESULTS" });
      return metadataResponse({ status: "ZERO_RESULTS" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const imagery = await resolvePropertyMapImagery({
      latitude: 47.6,
      longitude: -122.33,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(imagery.streetImageSrc).toBeNull();
    expect(imagery.aerialSrc).toContain("maptype=satellite");
    expect(imagery.mapsConfigured).toBe(true);
  });

  it("uses the default panorama when the outdoor search misses", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn(async (url: string) => {
      const source = new URL(String(url)).searchParams.get("source");
      if (source === "outdoor") return metadataResponse({ status: "ZERO_RESULTS" });
      return metadataResponse({
        status: "OK",
        pano_id: "pano-default",
        location: { lat: 47.599, lng: -122.33 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const imagery = await resolvePropertyMapImagery({
      latitude: 47.6,
      longitude: -122.33,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(imagery.streetImageSrc ?? "").searchParams.get("pano")).toBe("pano-default");
  });

  it("skips the street photo when the key is denied and still keeps aerial", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => metadataResponse({ status: "REQUEST_DENIED" }));
    vi.stubGlobal("fetch", fetchMock);

    const imagery = await resolvePropertyMapImagery({
      latitude: 47.6,
      longitude: -122.33,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(imagery.streetImageSrc).toBeNull();
    expect(imagery.aerialSrc).toContain("center=47.6");
  });

  it("still offers a best-effort photo URL when metadata cannot be read", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => metadataResponse("nope", 503)));

    const imagery = await resolvePropertyMapImagery({
      latitude: 47.6,
      longitude: -122.33,
    });

    const street = new URL(imagery.streetImageSrc ?? "");
    expect(street.searchParams.get("return_error_code")).toBe("true");
    expect(street.searchParams.get("pano")).toBeNull();
    expect(street.searchParams.get("location")).toBe("47.6,-122.33");
    expect(street.searchParams.get("size")).toBe("640x384");
    expect(street.searchParams.get("source")).toBeNull();
  });

  it("searches by address when the property has no coordinates", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn(async () =>
      metadataResponse({
        status: "OK",
        pano_id: "pano-address",
        location: { lat: 47.5, lng: -122.2 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const imagery = await resolvePropertyMapImagery({
      address: "100 Test Street, Springfield, WA",
    });

    const metadataUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(new URL(metadataUrl).searchParams.get("location")).toBe(
      "100 Test Street, Springfield, WA",
    );
    expect(imagery.aerialSrc).toBeNull();
    expect(new URL(imagery.streetImageSrc ?? "").searchParams.get("pano")).toBe("pano-address");
    expect(new URL(imagery.streetImageSrc ?? "").searchParams.get("heading")).toBeNull();
  });

  it("leaves both views empty when maps are not configured", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_EMBED_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const imagery = await resolvePropertyMapImagery({
      latitude: 47.6,
      longitude: -122.33,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(imagery).toEqual({
      streetImageSrc: null,
      aerialSrc: null,
      mapsConfigured: false,
    });
  });
});
