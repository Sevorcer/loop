import { describe, expect, it } from "vitest";

import {
  accountSetupRedirect,
  classifyPasswordLink,
  parsePasswordLink,
  passwordLinkHandoffHref,
  passwordRecoveryRedirect,
} from "@/features/auth/lib/passwordLink";

const INVITE_HASH =
  "#access_token=invite-access&refresh_token=invite-refresh&type=invite";
const RECOVERY_HASH =
  "#access_token=recovery-access&refresh_token=recovery-refresh&type=recovery";

describe("parsePasswordLink / classifyPasswordLink", () => {
  it("treats a fresh invite hash as account setup, not an expired reset", () => {
    const link = parsePasswordLink(INVITE_HASH, "");
    expect(link.kind).toBe("invite");
    expect(link.otpType).toBe("invite");
    expect(classifyPasswordLink(link)).toEqual({ action: "establish", kind: "invite" });
  });

  it("keeps a recovery hash on the password-reset path", () => {
    const link = parsePasswordLink(RECOVERY_HASH, "");
    expect(classifyPasswordLink(link)).toEqual({ action: "establish", kind: "recovery" });
  });

  it("reads an invite token hash from the query string", () => {
    const link = parsePasswordLink("", "?token_hash=hash-1&type=invite");
    expect(link.tokenHash).toBe("hash-1");
    expect(link.otpType).toBe("invite");
    expect(classifyPasswordLink(link)).toEqual({ action: "establish", kind: "invite" });
  });

  it("reads a recovery code without turning it into an invite", () => {
    const link = parsePasswordLink("", "?code=pkce-code&type=recovery");
    expect(classifyPasswordLink(link)).toEqual({ action: "establish", kind: "recovery" });
  });

  it("describes an expired invite from the flow marker, even though the error hash has no type", () => {
    const link = parsePasswordLink(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      "?flow=invite",
    );
    expect(link.hasAuthError).toBe(true);
    expect(classifyPasswordLink(link)).toEqual({ action: "expired", kind: "invite" });
  });

  it("keeps an expired recovery on the reset path", () => {
    const link = parsePasswordLink(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      "",
    );
    expect(classifyPasswordLink(link)).toEqual({ action: "invalid" });
  });

  it("does not accept a signup or magic-link token as account setup", () => {
    expect(
      classifyPasswordLink(
        parsePasswordLink("#access_token=signup-access&refresh_token=signup-refresh&type=signup", ""),
      ),
    ).toEqual({ action: "invalid" });
    expect(
      classifyPasswordLink(
        parsePasswordLink(
          "#access_token=magic-access&refresh_token=magic-refresh&type=magiclink",
          "?flow=invite",
        ),
      ),
    ).toEqual({ action: "invalid" });
  });

  it("keeps a refresh on the same path after the hash tokens are removed", () => {
    expect(classifyPasswordLink(parsePasswordLink("", "?flow=invite"))).toEqual({
      action: "expired",
      kind: "invite",
    });
    expect(classifyPasswordLink(parsePasswordLink("", "?flow=recovery"))).toEqual({
      action: "expired",
      kind: "recovery",
    });
  });

  it("uses the recovery token type when a consumed invite is resent as recovery", () => {
    const link = parsePasswordLink(RECOVERY_HASH, "?flow=invite");
    expect(link.kind).toBe("invite");
    expect(link.otpType).toBe("recovery");
    expect(classifyPasswordLink(link)).toEqual({ action: "establish", kind: "invite" });
  });
});

describe("password link redirects", () => {
  it("points invites at the setup page and does not put a role in the URL", () => {
    const url = accountSetupRedirect("https://loop.example");
    expect(url).toBe("https://loop.example/update-password?flow=invite");
    expect(url).not.toContain("app_role");
    expect(url).not.toContain("role=");
  });

  it("points password recovery at the reset page without the invite marker", () => {
    expect(passwordRecoveryRedirect("https://loop.example")).toBe(
      "https://loop.example/update-password",
    );
  });

  it("moves an invite hash onto the setup page and leaves the setup page alone", () => {
    expect(passwordLinkHandoffHref("/sign-in", INVITE_HASH, "?next=/jobs")).toBe(
      `/update-password?flow=invite${INVITE_HASH}`,
    );
    expect(passwordLinkHandoffHref("/update-password", INVITE_HASH, "?flow=invite")).toBeNull();
  });

  it("moves a recovery hash without marking it as an invite", () => {
    expect(passwordLinkHandoffHref("/jobs", RECOVERY_HASH, "")).toBe(
      `/update-password${RECOVERY_HASH}`,
    );
  });

  it("keeps a token hash on the setup URL and drops unrelated query params", () => {
    expect(
      passwordLinkHandoffHref("/sign-in", "", "?token_hash=hash-1&type=invite&next=/jobs"),
    ).toBe("/update-password?flow=invite&token_hash=hash-1&type=invite");
  });
});
