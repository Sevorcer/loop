import { describe, expect, it } from "vitest";

import { manualKindLabel } from "../utils/manualList";
import { manualLink } from "../utils/manualLink";

const base = { id: "m1", webViewLink: "https://drive.google.com/file/d/abc/view", hasLocalFile: false };

describe("manualLink", () => {
  it("opens a stored manual from LOOP (same-origin, not external)", () => {
    expect(manualLink({ ...base, hasLocalFile: true })).toEqual({ href: "/api/manuals/m1/file", external: false });
  });

  it("falls back to the Drive link only when there is no stored copy", () => {
    expect(manualLink(base)).toEqual({ href: base.webViewLink, external: true });
    expect(manualLink({ ...base, hasLocalFile: undefined })).toEqual({ href: base.webViewLink, external: true });
  });

  it("returns null when there is nothing to open", () => {
    expect(manualLink({ ...base, webViewLink: "" })).toBeNull();
  });

  it("prefers the stored copy even when Drive link is empty", () => {
    expect(manualLink({ ...base, webViewLink: "", hasLocalFile: true })?.external).toBe(false);
  });
});

describe("manualKindLabel", () => {
  const doc = "application/vnd.google-apps.document";
  it("flags a Google Doc served from its converted PDF", () => {
    expect(manualKindLabel({ mimeType: doc, hasLocalFile: true })).toBe("PDF · converted from Google Doc");
  });
  it("keeps the normal labels otherwise", () => {
    expect(manualKindLabel({ mimeType: doc })).toBe("Google Doc");
    expect(manualKindLabel({ mimeType: "application/pdf", hasLocalFile: true })).toBe("PDF");
  });
});
