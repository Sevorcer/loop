// @vitest-environment happy-dom
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { act, createElement, type ComponentProps, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    onError,
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) =>
    createElement("img", { alt, src, onError }),
}));

import { MapViewCard } from "@/features/properties/components/MapViewCard";

const roots: Root[] = [];

const STREET_URL = "https://maps.googleapis.com/maps/api/streetview?size=640x384&pano=pano-ok&key=test-key";
const AERIAL_URL = "https://www.google.com/maps/embed/v1/view?center=47.6,-122.33&zoom=19&maptype=satellite";

async function render(props: Partial<ComponentProps<typeof MapViewCard>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      createElement(MapViewCard, {
        streetImageSrc: STREET_URL,
        aerialSrc: AERIAL_URL,
        mapsConfigured: true,
        navigationUrl: "https://www.google.com/maps/search/?api=1&query=47.6,-122.33",
        appleMapsUrl: "https://maps.apple.com/?q=47.6,-122.33",
        arrivalAddress: "100 Test Street, Springfield, WA",
        propertyName: "Test Property",
        ...props,
      }),
    );
  });
  return container;
}

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots.length = 0;
  document.body.innerHTML = "";
});

describe("MapViewCard property photo", () => {
  it("renders a valid street photo URL", async () => {
    const container = await render();
    const image = container.querySelector("img");

    expect(image?.getAttribute("src")).toBe(STREET_URL);
    expect(image?.getAttribute("alt")).toBe("Street-side image of Test Property");
    expect(container.textContent).not.toContain("unavailable");
    expect(container.textContent).toContain("Static street-side image");
  });

  it("replaces a failed or expired street photo with the satellite view", async () => {
    const container = await render();
    const image = container.querySelector("img");
    expect(image).not.toBeNull();

    await act(async () => {
      image?.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("img")).toBeNull();
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(AERIAL_URL);
    expect(container.textContent).toContain("Satellite overview");
    expect(container.textContent).not.toContain("unavailable");
    expect(container.textContent).not.toContain("Street-side image unavailable");
  });

  it("shows a clean empty state when a bad photo URL has no satellite fallback", async () => {
    const container = await render({
      streetImageSrc: "https://maps.googleapis.com/maps/api/streetview?size=640x384&key=expired",
      aerialSrc: null,
    });

    await act(async () => {
      container.querySelector("img")?.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("No street-side photo");
    expect(container.textContent).not.toContain("unavailable");
    expect(container.textContent).toContain("100 Test Street, Springfield, WA");
  });

  it("keeps the administrator message only when maps are not configured", async () => {
    const container = await render({
      streetImageSrc: null,
      aerialSrc: null,
      mapsConfigured: false,
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Property imagery unavailable");
    expect(container.textContent).toContain("Contact your administrator to enable maps.");
  });

  it("does not call a missing photo an unavailable error when maps are configured", async () => {
    const container = await render({
      streetImageSrc: null,
      aerialSrc: null,
      mapsConfigured: true,
    });

    expect(container.textContent).toContain("No street-side photo");
    expect(container.textContent).not.toContain("unavailable");
    expect(container.textContent).not.toContain("Contact your administrator");
  });
});
