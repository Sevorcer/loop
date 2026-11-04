import { describe, expect, it } from "vitest";

import { constantTimeCompare } from "../constantTimeCompare";

describe("constantTimeCompare", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeCompare("secret-token-123", "secret-token-123")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(constantTimeCompare("secret-token-aaa", "secret-token-bbb")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(constantTimeCompare("short", "a-much-longer-string")).toBe(false);
    expect(constantTimeCompare("a-much-longer-string", "short")).toBe(false);
  });

  it("returns false when either string is empty", () => {
    expect(constantTimeCompare("", "nonempty")).toBe(false);
    expect(constantTimeCompare("nonempty", "")).toBe(false);
    expect(constantTimeCompare("", "")).toBe(false);
  });

  it("handles unicode strings", () => {
    expect(constantTimeCompare("héllo", "héllo")).toBe(true);
    expect(constantTimeCompare("héllo", "hello")).toBe(false);
  });
});
