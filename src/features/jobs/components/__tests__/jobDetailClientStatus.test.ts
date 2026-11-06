// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "../../types/job";

const requestJson = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const pushToast = vi.hoisted(() => vi.fn());
const captured = vi.hoisted(() => ({
  onUpdateStatus: null as null | ((status: string) => Promise<void>),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: "owner", setDevRole: () => {} }),
}));

vi.mock("@/lib/api/client", () => ({
  requestJson: (...args: unknown[]) => requestJson(...args),
}));

vi.mock("@/components/ui/toast", () => ({
  pushToast: (...args: unknown[]) => pushToast(...args),
}));

// The screen is stubbed; the test only needs the status handler it receives.
vi.mock("../JobDetailScreen", () => ({
  JobDetailScreen: (props: { onUpdateStatus: (status: string) => Promise<void> }) => {
    captured.onUpdateStatus = props.onUpdateStatus;
    return null;
  },
}));

import { JobDetailClient } from "../JobDetailClient";

const job = { id: "job-1", status: "In Progress", noSystemInstalled: false } as unknown as Job;

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(JobDetailClient, {
        job,
        activity: [],
        notes: [],
        callbackContext: {} as never,
      }),
    );
  });
  return root;
}

describe("JobDetailClient status updates", () => {
  beforeEach(() => {
    requestJson.mockReset();
    refresh.mockReset();
    pushToast.mockReset();
    captured.onUpdateStatus = null;
  });

  it("rejects when the server refuses the change, so callers never report success", async () => {
    requestJson.mockRejectedValueOnce(
      new Error("Cannot complete job — missing at least one photo."),
    );
    const root = await mount();

    await expect(captured.onUpdateStatus!("Completed")).rejects.toThrow(
      "Cannot complete job",
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(pushToast).not.toHaveBeenCalledWith(
      "Job moved to Completed.",
      "success",
    );

    await act(async () => {
      root.unmount();
    });
  });

  it("resolves, toasts and refreshes when the server accepts the change", async () => {
    requestJson.mockResolvedValueOnce({});
    const root = await mount();

    await act(async () => {
      await captured.onUpdateStatus!("Completed");
    });
    expect(pushToast).toHaveBeenCalledWith("Job moved to Completed.", "success");
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
