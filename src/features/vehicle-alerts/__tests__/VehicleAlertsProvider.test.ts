// @vitest-environment happy-dom
import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestJsonMock, useCurrentRoleMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
  useCurrentRoleMock: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  useCurrentRole: useCurrentRoleMock,
}));

vi.mock("@/lib/api/client", () => ({
  requestJson: requestJsonMock,
  ApiRequestError: class ApiRequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import {
  VehicleAlertsProvider,
  useVehicleAlerts,
} from "../state/VehicleAlertsProvider";
import type { VehicleAlert } from "../types/vehicleAlert";

const sample: VehicleAlert = {
  id: "va-1",
  vehicleId: "veh-4",
  vehicleName: "Van 4",
  title: "Oil change",
  description: "Soon",
  priority: "Medium",
  status: "New",
  reportedBy: "Luis M.",
  reportedAt: "2026-11-04",
};

function Probe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useVehicleAlerts>) => void;
}) {
  const api = useVehicleAlerts();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return createElement("div", {
    "data-hydrated": String(api.hydrated),
    "data-count": String(api.alerts.length),
  });
}

describe("VehicleAlertsProvider", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    useCurrentRoleMock.mockReturnValue({ role: "office" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("fetches alerts from the API (not mock/localStorage)", async () => {
    requestJsonMock.mockResolvedValueOnce({ alerts: [sample] });

    let latest: ReturnType<typeof useVehicleAlerts> | null = null;
    await act(async () => {
      root.render(
        createElement(
          VehicleAlertsProvider,
          null,
          createElement(Probe, {
            onReady: (api) => {
              latest = api;
            },
          }),
        ),
      );
    });

    // allow effect to settle
    await act(async () => {
      await Promise.resolve();
    });

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/api/vehicle-alerts",
      expect.objectContaining({ role: "office", cache: "no-store" }),
    );
    expect(latest?.hydrated).toBe(true);
    expect(latest?.alerts).toEqual([sample]);
    expect(window.localStorage.getItem("loop.vehicle-alerts.items")).toBeNull();
  });

  it("creates via POST and replaces the optimistic row", async () => {
    requestJsonMock
      .mockResolvedValueOnce({ alerts: [] })
      .mockResolvedValueOnce({
        alert: { ...sample, id: "va-server", reportedBy: "Office User" },
      });

    let latest: ReturnType<typeof useVehicleAlerts> | null = null;
    await act(async () => {
      root.render(
        createElement(
          VehicleAlertsProvider,
          null,
          createElement(Probe, {
            onReady: (api) => {
              latest = api;
            },
          }),
        ),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    let optimistic: VehicleAlert | null = null;
    await act(async () => {
      optimistic = latest!.createAlert({
        vehicleId: "veh-4",
        vehicleName: "Van 4",
        title: "Oil change",
        description: "Soon",
        reportedBy: "Form Name",
        priority: "Medium",
      });
    });

    expect(optimistic?.id.startsWith("pending-")).toBe(true);
    expect(requestJsonMock).toHaveBeenCalledWith(
      "/api/vehicle-alerts",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          vehicleId: "veh-4",
          title: "Oil change",
          priority: "Medium",
        }),
      }),
    );
    const postBody = requestJsonMock.mock.calls.find(
      (call: unknown[]) => (call[1] as { method?: string } | undefined)?.method === "POST",
    )?.[1]?.body as Record<string, unknown>;
    expect(postBody).not.toHaveProperty("reportedBy");
    expect(postBody).not.toHaveProperty("vehicleName");

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest?.alerts.some((a) => a.id === "va-server")).toBe(true);
    expect(latest?.alerts.some((a) => a.id.startsWith("pending-"))).toBe(false);
  });

  it("updates status via PATCH", async () => {
    requestJsonMock
      .mockResolvedValueOnce({ alerts: [sample] })
      .mockResolvedValueOnce({
        alert: { ...sample, status: "Acknowledged" },
      });

    let latest: ReturnType<typeof useVehicleAlerts> | null = null;
    await act(async () => {
      root.render(
        createElement(
          VehicleAlertsProvider,
          null,
          createElement(Probe, {
            onReady: (api) => {
              latest = api;
            },
          }),
        ),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      latest!.updateAlertStatus("va-1", "Acknowledged");
    });

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/api/vehicle-alerts/va-1",
      expect.objectContaining({
        method: "PATCH",
        body: { status: "Acknowledged" },
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest?.alerts[0]?.status).toBe("Acknowledged");
  });
});
