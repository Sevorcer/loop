// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  requestJson: () => Promise.reject(new Error("job search is not used on a job")),
}));

import { JobPermitsCard } from "../components/JobPermitsCard";

interface CardPermit {
  id: string;
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: string;
  appliedAt: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  notes: string | null;
  correctionsNotes: string | null;
  documentStorageId: string | null;
}

const roots: Root[] = [];
const fetchMock = vi.fn();
let permits: CardPermit[] = [];
let denyCreate = false;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

async function renderCard(canEdit: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      createElement(JobPermitsCard, {
        jobId: "job-9",
        canEdit,
        jobLabel: "JOB-44 — Northwind",
      }),
    );
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
  return document.body.querySelector("[aria-label='Add permit']") as HTMLElement | null;
}

async function click(button: Element | null | undefined) {
  expect(button, "expected a button to click").toBeTruthy();
  await act(async () => {
    (button as HTMLButtonElement).click();
  });
}

async function fill(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function openAndFill() {
  const trigger = buttons(document.body, "Add Permit").find(
    (button) => !button.closest("[aria-label='Add permit']"),
  );
  await click(trigger);
  const dialog = addDialog();
  expect(dialog).toBeTruthy();
  expect(dialog!.textContent).toContain("JOB-44 — Northwind");
  expect(dialog!.querySelector("[aria-label='Search jobs']")).toBeNull();
  await fill(
    dialog!.querySelector("input[placeholder='e.g. City of Seattle']") as HTMLInputElement,
    " Seattle ",
  );
  await fill(
    dialog!.querySelector("input[placeholder='e.g. Mechanical']") as HTMLInputElement,
    "Mechanical",
  );
  return dialog!;
}

beforeEach(() => {
  permits = [];
  denyCreate = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && url === "/api/jobs/job-9/permits") {
      return jsonResponse({ permits });
    }
    if (method === "POST" && url === "/api/jobs/job-9/permits") {
      if (denyCreate) {
        return jsonResponse(
          {
            error: "FORBIDDEN",
            message: "Only office staff and above can create permits.",
          },
          false,
          403,
        );
      }
      const body = JSON.parse(String(init?.body)) as {
        jurisdiction: string;
        permitType: string;
        permitNumber: string | null;
        status: string;
        notes: string | null;
        appliedAt: string | null;
        issuedAt: string | null;
        correctionsNotes: string | null;
      };
      const created: CardPermit = {
        id: "permit-new",
        jurisdiction: body.jurisdiction,
        permitType: body.permitType,
        permitNumber: body.permitNumber,
        status: body.status,
        appliedAt: body.appliedAt,
        issuedAt: body.issuedAt,
        voidedAt: null,
        notes: body.notes,
        correctionsNotes: body.correctionsNotes,
        documentStorageId: null,
      };
      permits = [created];
      return jsonResponse({ permit: created }, true, 201);
    }
    return jsonResponse({ error: `unexpected ${method} ${url}` }, false, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("job page add permit", () => {
  it("creates a permit on this job and shows it on the card", async () => {
    const container = await renderCard(true);
    expect(container.textContent).toContain("No permits recorded.");

    const dialog = await openAndFill();
    expect(dialog.querySelector("[aria-label='Status']")?.textContent).toContain(
      "Applied",
    );
    await click(dialog.querySelector("button[type='submit']"));
    await act(async () => {});

    const post = fetchMock.mock.calls.find(
      (call) => call[1]?.method === "POST",
    );
    expect(post?.[0]).toBe("/api/jobs/job-9/permits");
    expect(JSON.parse(String(post?.[1].body))).toEqual({
      jurisdiction: "Seattle",
      permitType: "Mechanical",
      permitNumber: null,
      status: "applied",
      appliedAt: null,
      intakeAppointmentAt: null,
      issuedAt: null,
      correctionsNotes: null,
      notes: null,
    });
    expect(addDialog()).toBeNull();
    expect(container.textContent).toContain("Seattle — Mechanical");
    expect(container.textContent).toContain("Applied");
    expect(container.textContent).toContain("Permits (1)");
  });

  it("shows the permission error and does not add a permit when create is forbidden", async () => {
    denyCreate = true;
    const container = await renderCard(true);
    const dialog = await openAndFill();
    await click(dialog.querySelector("button[type='submit']"));
    await act(async () => {});

    expect(dialog.textContent).toContain(
      "Only office staff and above can create permits.",
    );
    expect(addDialog()).toBeTruthy();
    expect(container.textContent).toContain("No permits recorded.");
    expect(container.textContent).not.toContain("Seattle — Mechanical");
  });

  it("hides add permit when the role cannot edit permits", async () => {
    const container = await renderCard(false);
    expect(buttons(container, "Add Permit")).toHaveLength(0);
    expect(addDialog()).toBeNull();
    expect(container.textContent).toContain("No permits recorded.");
    expect(
      fetchMock.mock.calls.filter((call) => call[1]?.method === "POST"),
    ).toHaveLength(0);
  });
});
