// @vitest-environment happy-dom
import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestJsonMock, useCurrentRoleMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
  useCurrentRoleMock: vi.fn(),
}));

vi.mock("@/features/auth", () => ({ useCurrentRole: useCurrentRoleMock }));
vi.mock("@/lib/api/client", () => ({ requestJson: requestJsonMock }));

import { JobMaterialsProvider, useJobMaterials } from "../state/JobMaterialsProvider";
import { JobTechnicalDataProvider, useJobTechnicalData } from "../state/JobTechnicalDataProvider";
import type { JobMaterialLine, JobMaterialSummary } from "../types/jobMaterials";

const JOB = "11111111-1111-4111-8111-111111111111";

function line(overrides: Partial<JobMaterialLine> = {}): JobMaterialLine {
  return {
    id: "l1",
    jobId: JOB,
    name: "Condensate pump",
    quantity: 1,
    unit: "ea",
    partNumber: null,
    notes: "",
    state: "needed",
    sortOrder: 0,
    createdBy: null,
    createdAt: "2026-11-04T00:00:00Z",
    updatedBy: null,
    updatedAt: "2026-11-04T00:00:00Z",
    stateChangedBy: null,
    stateChangedAt: null,
    planId: null,
    catalogItemId: null,
    catalogItem: null,
    source: "manual",
    kitId: null,
    kitQuantity: null,
    isOptional: false,
    nonStockReason: null,
    ...overrides,
  };
}

type MaterialsApi = ReturnType<typeof useJobMaterials>;

function MaterialsProbe({ onReady }: { onReady: (api: MaterialsApi) => void }) {
  const api = useJobMaterials();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

type TechApi = ReturnType<typeof useJobTechnicalData>;

function TechProbe({ onReady }: { onReady: (api: TechApi) => void }) {
  const api = useJobTechnicalData();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("JobMaterialsProvider", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let latest: MaterialsApi | null;
  let summaries: JobMaterialSummary[];

  async function mount() {
    await act(async () => {
      root.render(
        createElement(
          JobMaterialsProvider,
          { jobId: JOB, onSummaryChange: (s: JobMaterialSummary) => summaries.push(s) },
          createElement(MaterialsProbe, { onReady: (api) => {
            latest = api;
          } }),
        ),
      );
    });
    await flush();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    latest = null;
    summaries = [];
    useCurrentRoleMock.mockReturnValue({ role: "office" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("loads the job's lines from the API and reports a summary", async () => {
    requestJsonMock.mockResolvedValueOnce({ materials: [line(), line({ id: "l2", state: "on_truck" })] });
    await mount();
    expect(requestJsonMock).toHaveBeenCalledWith(
      `/api/jobs/${JOB}/materials`,
      expect.objectContaining({ role: "office", cache: "no-store" }),
    );
    expect(latest?.loading).toBe(false);
    expect(latest?.lines).toHaveLength(2);
    expect(latest?.summary).toEqual({ total: 2, needed: 1, onTruck: 1, used: 0 });
    expect(summaries.at(-1)).toEqual({ total: 2, needed: 1, onTruck: 1, used: 0 });
    expect(latest?.canManage).toBe(true);
  });

  it("does not fetch until a role is known", async () => {
    useCurrentRoleMock.mockReturnValue({ role: null });
    await mount();
    expect(requestJsonMock).not.toHaveBeenCalled();
  });

  it("moves state optimistically and keeps the server row", async () => {
    requestJsonMock
      .mockResolvedValueOnce({ materials: [line()] })
      .mockResolvedValueOnce({ material: line({ state: "on_truck", stateChangedAt: "2026-11-04T22:00:00Z" }) });
    await mount();

    await act(async () => {
      await latest!.setLineState("l1", "on_truck");
    });

    expect(requestJsonMock).toHaveBeenLastCalledWith(
      `/api/jobs/${JOB}/materials/l1`,
      expect.objectContaining({ method: "PATCH", body: { state: "on_truck" } }),
    );
    expect(latest?.lines[0].state).toBe("on_truck");
    expect(latest?.lines[0].stateChangedAt).toBe("2026-11-04T22:00:00Z");
    expect(latest?.pendingIds.size).toBe(0);
    expect(summaries.at(-1)?.onTruck).toBe(1);
  });

  it("reverts and shows the error when the write fails", async () => {
    requestJsonMock
      .mockResolvedValueOnce({ materials: [line({ quantity: 2 })] })
      .mockRejectedValueOnce(new Error("Technicians can only change a material's state and quantity"));
    await mount();

    let ok = true;
    await act(async () => {
      ok = await latest!.setLineQuantity("l1", 5);
    });

    expect(ok).toBe(false);
    expect(latest?.lines[0].quantity).toBe(2);
    expect(latest?.error).toMatch(/Technicians/);
  });

  it("adds and removes lines for office roles", async () => {
    requestJsonMock
      .mockResolvedValueOnce({ materials: [] })
      .mockResolvedValueOnce({ material: line({ id: "new" }) })
      .mockResolvedValueOnce({ ok: true });
    await mount();

    await act(async () => {
      await latest!.addLine({ name: "Condensate pump" });
    });
    expect(requestJsonMock).toHaveBeenNthCalledWith(
      2,
      `/api/jobs/${JOB}/materials`,
      expect.objectContaining({ method: "POST", body: { name: "Condensate pump" } }),
    );
    expect(latest?.lines.map((l) => l.id)).toEqual(["new"]);

    await act(async () => {
      await latest!.removeLine("new");
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      `/api/jobs/${JOB}/materials/new`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(latest?.lines).toEqual([]);
  });

  it("a tech can move state but never add or remove (no request sent)", async () => {
    useCurrentRoleMock.mockReturnValue({ role: "tech" });
    requestJsonMock.mockResolvedValueOnce({ materials: [line()] });
    await mount();
    expect(latest?.canManage).toBe(false);
    expect(latest?.canProgress).toBe(true);

    let added = true;
    let removed = true;
    await act(async () => {
      added = await latest!.addLine({ name: "x" });
      removed = await latest!.removeLine("l1");
    });
    expect(added).toBe(false);
    expect(removed).toBe(false);
    expect(requestJsonMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a load failure", async () => {
    requestJsonMock.mockRejectedValueOnce(new Error("relation does not exist"));
    await mount();
    expect(latest?.loading).toBe(false);
    expect(latest?.error).toBe("relation does not exist");
    expect(latest?.lines).toEqual([]);
  });
});

describe("JobTechnicalDataProvider", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let latest: TechApi | null;

  async function mount() {
    await act(async () => {
      root.render(
        createElement(
          JobTechnicalDataProvider,
          { jobId: JOB },
          createElement(TechProbe, { onReady: (api) => {
            latest = api;
          } }),
        ),
      );
    });
    await flush();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    latest = null;
    useCurrentRoleMock.mockReturnValue({ role: "tech" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("loads technical data for the job", async () => {
    const technicalData = { jobId: JOB, propertyId: "p", systems: [], gaps: ["No equipment"] };
    requestJsonMock.mockResolvedValueOnce({ technicalData });
    await mount();
    expect(requestJsonMock).toHaveBeenCalledWith(
      `/api/jobs/${JOB}/technical-data`,
      expect.objectContaining({ role: "tech", cache: "no-store" }),
    );
    expect(latest?.loading).toBe(false);
    expect(latest?.data).toEqual(technicalData);
  });

  it("shows the error (e.g. 404 for an unassigned job)", async () => {
    requestJsonMock.mockRejectedValueOnce(new Error("Job not found."));
    await mount();
    expect(latest?.data).toBeNull();
    expect(latest?.error).toBe("Job not found.");
  });
});
