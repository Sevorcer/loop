// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ role: "office" as string | null }));
const requestJson = vi.hoisted(() => vi.fn());

vi.mock("next/link", async () => {
  const { createElement: create } = await import("react");
  return {
    default: ({
      children,
      href,
    }: {
      children?: ReactNode;
      href?: string;
    }) => create("a", { href: typeof href === "string" ? href : "#" }, children),
  };
});

vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: authState.role, setDevRole: () => {} }),
}));

vi.mock("@/lib/api/client", () => ({
  requestJson: (...args: unknown[]) => requestJson(...args),
}));

import { PermitsBoardScreen } from "../screens/PermitsBoardScreen";

interface BoardPermit {
  id: string;
  jobId: string;
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: string;
  appliedAt: string | null;
  intakeAppointmentAt: string | null;
  issuedAt: string | null;
  correctionsNotes: string | null;
  notes: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  jobCustomerName: string | null;
  jobPropertyName: string | null;
  documentStorageId: string | null;
}

const roots: Root[] = [];
let permits: BoardPermit[] = [];
let denyCreate = false;

function permit(overrides: Partial<BoardPermit> = {}): BoardPermit {
  return {
    id: "permit-1",
    jobId: "job-1",
    jurisdiction: "Seattle",
    permitType: "Mechanical",
    permitNumber: "MEC-1",
    status: "applied",
    appliedAt: "2026-11-01",
    intakeAppointmentAt: null,
    issuedAt: null,
    correctionsNotes: null,
    notes: null,
    voidedAt: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    jobCustomerName: "Ada Homes",
    jobPropertyName: "12 Pine",
    documentStorageId: null,
    ...overrides,
  };
}

async function renderBoard() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(createElement(PermitsBoardScreen));
  });
  await act(async () => {});
  return container;
}

function buttons(root: ParentNode, text: string) {
  return [...root.querySelectorAll("button")].filter((button) =>
    button.textContent?.includes(text),
  );
}

function addDialog() {
  return document.body.querySelector("[aria-label='Add permit']");
}

async function click(button: Element | null | undefined) {
  expect(button, "expected a button to click").toBeTruthy();
  await act(async () => {
    (button as HTMLButtonElement).click();
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    setInputValue(input, value);
  });
}

async function chooseJob() {
  const dialog = addDialog() as HTMLElement;
  const search = dialog.querySelector(
    "[aria-label='Search jobs']",
  ) as HTMLInputElement;
  await fill(search, "Ada");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
  await act(async () => {});
  const option = buttons(addDialog() as HTMLElement, "JOB-12 — Ada Homes")[0];
  await click(option);
}

beforeEach(() => {
  authState.role = "office";
  permits = [];
  denyCreate = false;
  requestJson.mockReset();
  requestJson.mockImplementation(
    async (
      url: string,
      options?: { method?: string; body?: Record<string, unknown> },
    ) => {
      const method = options?.method ?? "GET";
      if (url === "/api/permits") return { permits };
      if (url.startsWith("/api/jobs?")) {
        return {
          jobs: [
            {
              id: "job-1",
              jobNumber: "JOB-12",
              customerName: "Ada Homes",
              propertyName: "12 Pine",
              title: "Furnace replacement",
            },
          ],
        };
      }
      if (method === "POST" && url === "/api/jobs/job-1/permits") {
        if (denyCreate) {
          throw new Error("Only office staff and above can create permits.");
        }
        const body = options?.body ?? {};
        const created = permit({
          id: "permit-new",
          jurisdiction: String(body.jurisdiction ?? ""),
          permitType: String(body.permitType ?? ""),
          permitNumber: (body.permitNumber as string | null) ?? null,
          status: String(body.status ?? "applied"),
          notes: (body.notes as string | null) ?? null,
          appliedAt: (body.appliedAt as string | null) ?? null,
          createdAt: "2026-11-06T12:00:00.000Z",
        });
        permits = [created];
        return { permit: created };
      }
      if (method === "PATCH" && url === "/api/jobs/job-1/permits") {
        const body = options?.body ?? {};
        permits = permits.map((row) =>
          row.id === body.permitId
            ? {
                ...row,
                jurisdiction:
                  typeof body.jurisdiction === "string"
                    ? body.jurisdiction
                    : row.jurisdiction,
              }
            : row,
        );
        return { permit: permits[0] };
      }
      throw new Error(`unexpected ${method} ${url}`);
    },
  );
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

describe("permits board create", () => {
  it("lets office staff add a permit for a job and shows it on the board", async () => {
    const container = await renderBoard();
    expect(container.textContent).not.toContain("when created on jobs");
    expect(container.textContent).toContain(
      "Add a permit for a job. It shows up on this board and on the job.",
    );

    await click(buttons(container, "Add Permit")[0]);
    const dialog = addDialog() as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector("[aria-label='Status']")?.textContent).toContain(
      "Applied",
    );

    await click(dialog.querySelector("[aria-label='Status']"));
    expect(dialog.textContent).toContain("Waiting on City");
    expect(dialog.textContent).not.toContain("waiting_on_city");
    await click(buttons(dialog, "Waiting on City")[0]);

    await chooseJob();
    await fill(
      dialog.querySelector("input[placeholder='e.g. City of Seattle']") as HTMLInputElement,
      "Seattle",
    );
    await fill(
      dialog.querySelector("input[placeholder='e.g. Mechanical']") as HTMLInputElement,
      "Mechanical",
    );
    await fill(
      dialog.querySelector("input[placeholder='e.g. MEC-2024-001234']") as HTMLInputElement,
      "MEC-9",
    );

    await click(dialog.querySelector("button[type='submit']"));
    await act(async () => {});

    expect(requestJson).toHaveBeenCalledWith("/api/jobs/job-1/permits", {
      method: "POST",
      body: {
        jurisdiction: "Seattle",
        permitType: "Mechanical",
        permitNumber: "MEC-9",
        status: "waiting_on_city",
        appliedAt: null,
        intakeAppointmentAt: null,
        issuedAt: null,
        correctionsNotes: null,
        notes: null,
      },
    });
    expect(addDialog()).toBeNull();
    expect(container.textContent).toContain("Seattle — Mechanical");
    expect(container.textContent).toContain("Waiting on City");
    expect(container.textContent).toContain("Ada Homes");
  });

  it("keeps the panel open and does not list a permit when create is forbidden", async () => {
    denyCreate = true;
    const container = await renderBoard();
    await click(buttons(container, "Add Permit")[0]);
    await chooseJob();
    const dialog = addDialog() as HTMLElement;
    await fill(
      dialog.querySelector("input[placeholder='e.g. City of Seattle']") as HTMLInputElement,
      "Seattle",
    );
    await fill(
      dialog.querySelector("input[placeholder='e.g. Mechanical']") as HTMLInputElement,
      "Mechanical",
    );
    await click(dialog.querySelector("button[type='submit']"));
    await act(async () => {});

    expect(dialog.textContent).toContain(
      "Only office staff and above can create permits.",
    );
    expect(addDialog()).toBeTruthy();
    expect(container.textContent).toContain("No permits");
    expect(container.textContent).not.toContain("Seattle — Mechanical");
    expect(
      requestJson.mock.calls.filter((call) => call[0] === "/api/permits"),
    ).toHaveLength(1);
  });

  it.each(["tech", "dispatch", "sales", "portal"])(
    "hides add permit for %s",
    async (role) => {
      authState.role = role;
      const container = await renderBoard();
      expect(buttons(container, "Add Permit")).toHaveLength(0);
      expect(addDialog()).toBeNull();
      expect(container.textContent).toContain(
        "Permits added for a job show up on this board.",
      );
      expect(container.textContent).not.toContain("when created on jobs");
    },
  );

  it("still saves an edit through the shared permit fields", async () => {
    permits = [permit()];
    const container = await renderBoard();
    expect(container.textContent).toContain("Seattle — Mechanical");

    await click(container.querySelector("button[aria-label='Edit permit']"));
    const dialog = document.body.querySelector(
      "[role='dialog'][aria-label='Edit permit']",
    ) as HTMLElement;
    expect(dialog).toBeTruthy();
    await fill(
      dialog.querySelector("input[placeholder='e.g. City of Seattle']") as HTMLInputElement,
      "Bellevue",
    );
    await click(buttons(dialog, "Save Changes")[0]);
    await act(async () => {});

    expect(requestJson).toHaveBeenCalledWith(
      "/api/jobs/job-1/permits",
      expect.objectContaining({
        method: "PATCH",
        body: expect.objectContaining({
          permitId: "permit-1",
          jurisdiction: "Bellevue",
          permitType: "Mechanical",
          status: "applied",
        }),
      }),
    );
    expect(container.textContent).toContain("Bellevue — Mechanical");
  });
});
