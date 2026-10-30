import { describe, expect, it } from "vitest";

import { resolveSafeNextPath } from "@/lib/auth/safeNextPath";

describe("resolveSafeNextPath", () => {
  it("keeps same-origin relative paths, including query and hash", () => {
    expect(resolveSafeNextPath("/dashboard")).toBe("/dashboard");
    expect(resolveSafeNextPath("/jobs/abc-123")).toBe("/jobs/abc-123");
    expect(resolveSafeNextPath("/jobs?status=open&q=ac%20unit")).toBe(
      "/jobs?status=open&q=ac%20unit",
    );
    expect(resolveSafeNextPath("/settings/users#roles")).toBe("/settings/users#roles");
    expect(resolveSafeNextPath("/jobs?q=https://example.com")).toBe(
      "/jobs?q=https://example.com",
    );
    expect(resolveSafeNextPath("/ops/feedback")).toBe("/ops/feedback");
    expect(resolveSafeNextPath("  /calendar  ")).toBe("/calendar");
  });

  it("returns null when next is missing so the caller can use its default", () => {
    expect(resolveSafeNextPath(null)).toBeNull();
    expect(resolveSafeNextPath(undefined)).toBeNull();
    expect(resolveSafeNextPath("")).toBeNull();
    expect(resolveSafeNextPath("   ")).toBeNull();
  });

  it("rejects absolute URLs and protocol-relative URLs", () => {
    expect(resolveSafeNextPath("https://evil.example")).toBeNull();
    expect(resolveSafeNextPath("http://evil.example/dashboard")).toBeNull();
    expect(resolveSafeNextPath("https://evil.example/jobs")).toBeNull();
    expect(resolveSafeNextPath("//evil.example")).toBeNull();
    expect(resolveSafeNextPath("///evil.example")).toBeNull();
    expect(resolveSafeNextPath("//evil.example/dashboard")).toBeNull();
    expect(resolveSafeNextPath("javascript:alert(1)")).toBeNull();
    expect(resolveSafeNextPath("data:text/html,hi")).toBeNull();
    expect(resolveSafeNextPath("https:evil.example")).toBeNull();
  });

  it("rejects backslash and encoded-slash host tricks", () => {
    expect(resolveSafeNextPath("/\\evil.example")).toBeNull();
    expect(resolveSafeNextPath("\\\\evil.example")).toBeNull();
    expect(resolveSafeNextPath("/\\\\evil.example")).toBeNull();
    expect(resolveSafeNextPath("/%2f%2fevil.example")).toBeNull();
    expect(resolveSafeNextPath("/%2F/evil.example")).toBeNull();
    expect(resolveSafeNextPath("/%5Cevil.example")).toBeNull();
    expect(resolveSafeNextPath("/%5C%5Cevil.example")).toBeNull();
    expect(resolveSafeNextPath("/%252f%252fevil.example")).toBeNull();
    expect(resolveSafeNextPath("/%09/evil.example")).toBeNull();
    expect(resolveSafeNextPath("/dashboard%0d%0aLocation:%20https://evil.example")).toBeNull();
  });

  it("rejects control characters and overlong values", () => {
    expect(resolveSafeNextPath("/dash\nboard")).toBeNull();
    expect(resolveSafeNextPath("/dash\tboard")).toBeNull();
    expect(resolveSafeNextPath(`/${"a".repeat(2100)}`)).toBeNull();
  });

  it("still allows normal in-app paths that contain dots or encoded spaces", () => {
    expect(resolveSafeNextPath("/jobs/../dashboard")).toBe("/dashboard");
    expect(resolveSafeNextPath("/customers/ac%20me")).toBe("/customers/ac%20me");
  });
});
