// @vitest-environment happy-dom
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const establishPasswordLinkSession = vi.fn();
const getRecoverySession = vi.fn();
const updateUserPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/observability/auth", () => ({
  createCorrelationId: () => "corr-1",
  incrementAuthMetric: () => {},
  logAuthEvent: () => {},
}));

vi.mock("@/services/authClient", () => ({
  isAuthClientConfigured: () => true,
  establishPasswordLinkSession: (...args: unknown[]) => establishPasswordLinkSession(...args),
  getRecoverySession: (...args: unknown[]) => getRecoverySession(...args),
  updateUserPassword: (...args: unknown[]) => updateUserPassword(...args),
}));

import { UpdatePasswordScreen } from "@/features/auth/screens/UpdatePasswordScreen";

const roots: Root[] = [];

function renderScreen() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(createElement(UpdatePasswordScreen));
  });
  return container;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  establishPasswordLinkSession.mockReset();
  getRecoverySession.mockReset();
  updateUserPassword.mockReset();
  getRecoverySession.mockResolvedValue(null);
  window.history.replaceState(null, "", "/update-password");
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
});

describe("UpdatePasswordScreen invite and recovery links", () => {
  it("lets a fresh invite set a password and does not show the reset-expired page", async () => {
    window.history.replaceState(
      null,
      "",
      "/update-password#access_token=invite-access&refresh_token=invite-refresh&type=invite",
    );
    establishPasswordLinkSession.mockResolvedValue(true);

    const container = renderScreen();
    await flush();

    expect(container.textContent).toContain("Create your password");
    expect(container.textContent).not.toContain("Reset link invalid");
    expect(container.textContent).not.toContain("Invite expired");
    expect(container.querySelector("select")).toBeNull();
    expect(establishPasswordLinkSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "invite-access",
        refreshToken: "invite-refresh",
        otpType: "invite",
      }),
    );
    const payload = establishPasswordLinkSession.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("app_role");
    expect(payload).not.toHaveProperty("role");
  });

  it("explains an expired invite instead of calling it a password reset", async () => {
    window.history.replaceState(
      null,
      "",
      "/update-password?flow=invite#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    const container = renderScreen();
    await flush();

    expect(container.textContent).toContain("Invite expired");
    expect(container.textContent).toContain("Ask your office to send a new one");
    expect(container.textContent).not.toContain("Reset link invalid");
    expect(establishPasswordLinkSession).not.toHaveBeenCalled();
  });

  it("still shows the reset form for a recovery link", async () => {
    window.history.replaceState(
      null,
      "",
      "/update-password#access_token=recovery-access&refresh_token=recovery-refresh&type=recovery",
    );
    establishPasswordLinkSession.mockResolvedValue(true);

    const container = renderScreen();
    await flush();

    expect(container.textContent).toContain("Set a new password");
    expect(container.textContent).toContain("Update password");
    expect(container.textContent).not.toContain("Create your password");
    expect(container.textContent).not.toContain("Invite expired");
  });

  it("still shows the reset-expired page for an expired recovery link", async () => {
    window.history.replaceState(
      null,
      "",
      "/update-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );

    const container = renderScreen();
    await flush();

    expect(container.textContent).toContain("Reset link invalid");
    expect(container.textContent).not.toContain("Invite expired");
  });

  it("keeps the setup form after the hash is cleared when the session is still present", async () => {
    window.history.replaceState(null, "", "/update-password?flow=invite");
    getRecoverySession.mockResolvedValue({ access_token: "session-token" });

    const container = renderScreen();
    await flush();

    expect(container.textContent).toContain("Create your password");
    expect(container.textContent).not.toContain("Invite expired");
    expect(container.textContent).not.toContain("Reset link invalid");
    expect(establishPasswordLinkSession).not.toHaveBeenCalled();
  });

  it("does not open a password form for a signup token", async () => {
    window.history.replaceState(
      null,
      "",
      "/update-password#access_token=signup-access&refresh_token=signup-refresh&type=signup",
    );

    const container = renderScreen();
    await flush();

    expect(container.textContent).toContain("Reset link invalid");
    expect(establishPasswordLinkSession).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });
});
