import { describe, expect, it } from "vitest";

import {
  TRUSTED_ORG_HEADER,
  TRUSTED_ROLE_HEADER,
  TRUSTED_USER_HEADER,
  applyTrustedAuthHeaders,
  readTrustedAuthHeaders,
  stripTrustedAuthHeaders,
} from "../trustedRequestAuth";

describe("trustedRequestAuth headers", () => {
  it("stripTrustedAuthHeaders removes client-supplied trusted headers", () => {
    const headers = new Headers({
      [TRUSTED_USER_HEADER]: "spoof",
      [TRUSTED_ROLE_HEADER]: "owner",
      [TRUSTED_ORG_HEADER]: "org-x",
      "x-loop-role": "tech",
    });
    stripTrustedAuthHeaders(headers);
    expect(headers.get(TRUSTED_USER_HEADER)).toBeNull();
    expect(headers.get(TRUSTED_ROLE_HEADER)).toBeNull();
    expect(headers.get(TRUSTED_ORG_HEADER)).toBeNull();
    // Unrelated role header is left alone (dev harness); proxy does not
    // treat it as trusted carry-forward.
    expect(headers.get("x-loop-role")).toBe("tech");
  });

  it("apply then read round-trips", () => {
    const headers = new Headers({ [TRUSTED_ROLE_HEADER]: "spoof-owner" });
    applyTrustedAuthHeaders(headers, {
      userId: "user-1",
      role: "office",
      orgId: "org-1",
    });
    const req = new Request("http://localhost/api/x", { headers });
    expect(readTrustedAuthHeaders(req)).toEqual({
      userId: "user-1",
      role: "office",
      orgId: "org-1",
    });
  });
});
