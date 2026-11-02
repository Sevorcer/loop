// @vitest-environment happy-dom
import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "@/features/jobs/types/job";
import { todayInCompanyTimeZone } from "@/lib/timezone";

import {
  CALENDAR_PEOPLE_GROUPS_KEY,
  CALENDAR_PEOPLE_STORAGE_KEY,
} from "../utils/calendarPeopleFilter";
import { resetGroupImportClaims } from "../utils/calendarGroupSync";
import { CALENDAR_VIEW_STORAGE_KEY } from "../utils/calendarSchedule";

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", async () => {
  const { createElement: create } = await import("react");
  return {
    default: ({ children, href }: { children?: ReactNode; href?: string }) =>
      create("a", { href: typeof href === "string" ? href : "#" }, children),
  };
});

const authState = vi.hoisted(() => ({ role: "owner" }));
const requestJson = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: authState.role, setDevRole: () => {} }),
}));

vi.mock("@/lib/api/client", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiRequestError";
      this.status = status;
    }
  },
  requestJson: (...args: unknown[]) => requestJson(...args),
}));

import { CalendarScreen } from "../screens/CalendarScreen";

type JobsPayload = { jobs: Job[]; unscheduledCount: number };

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function job(partial: Partial<Job> & Pick<Job, "id">): Job {
  return {
    jobNumber: partial.id.toUpperCase(),
    title: "Service call",
    type: "Service",
    status: "Scheduled",
    priority: "Medium",
    customerName: "Customer",
    propertyName: "Property",
    assignedTo: "Alex Tech",
    scheduledFor: "2026-10-30",
    summary: "",
    location: "",
    notes: "",
    ...partial,
  };
}

const today = todayInCompanyTimeZone();
const [todayYear, todayMonth] = today.split("-").map(Number);
const currentMonthPrefix = today.slice(0, 7);
const nextMonthDay = new Date(Date.UTC(todayYear, todayMonth, 10)).toISOString().slice(0, 10);
const nextMonthTitle = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${nextMonthDay}T00:00:00Z`));

const currentJob = job({
  id: "current",
  jobNumber: "JOB-CURRENT",
  scheduledFor: today,
  scheduledStartAt: null,
  scheduledEndAt: null,
});
const nextJob = job({
  id: "next",
  jobNumber: "JOB-NEXT",
  scheduledFor: nextMonthDay,
  scheduledStartAt: null,
  scheduledEndAt: null,
});

// When set, jobs fetches for any range other than the current month wait
// on this gate so a test can observe the calendar mid-refetch.
let pendingJobs: Deferred<JobsPayload> | null = null;

const roots: Root[] = [];

async function render(node: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(node);
  });
  return container;
}

function nextMonthButton(container: HTMLElement) {
  return [...container.querySelectorAll("button")].find((button) =>
    button.getAttribute("aria-label")?.startsWith("Next"),
  );
}

beforeEach(() => {
  authState.role = "owner";
  pendingJobs = null;
  requestJson.mockImplementation(async (url: string) => {
    const path = String(url);
    if (path.includes("/api/calendar/jobs")) {
      const from = new URLSearchParams(path.split("?")[1] ?? "").get("from") ?? "";
      if (from.startsWith(currentMonthPrefix)) {
        return { jobs: [currentJob], unscheduledCount: 0 };
      }
      if (pendingJobs) return pendingJobs.promise;
      return { jobs: [nextJob], unscheduledCount: 0 };
    }
    if (path.includes("/api/calendar/groups")) return { groups: [] };
    if (path.includes("/api/calendar/team")) return { team: [] };
    return { timeOff: [], tasks: [] };
  });
});

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => {
      root?.unmount();
    });
  }
  document.body.innerHTML = "";
  localStorage.removeItem(CALENDAR_PEOPLE_STORAGE_KEY);
  localStorage.removeItem(CALENDAR_PEOPLE_GROUPS_KEY);
  localStorage.removeItem(CALENDAR_VIEW_STORAGE_KEY);
  resetGroupImportClaims();
  authState.role = "owner";
  pendingJobs = null;
});

describe("calendar jobs refetch loading state", () => {
  it("shows the loading treatment instead of the previous month's jobs while the next month loads", async () => {
    pendingJobs = deferred<JobsPayload>();
    const container = await render(createElement(CalendarScreen));

    await vi.waitFor(() => {
      expect(container.textContent).toContain("JOB-CURRENT");
    });
    expect(container.textContent).not.toContain("Loading calendar");

    await act(async () => {
      nextMonthButton(container)?.click();
    });

    // Mid-refetch the grid and day panel are replaced by the loading
    // treatment: the previous range's jobs must not be plotted against
    // the new month as if they belonged to it.
    expect(container.textContent).toContain("Loading calendar");
    expect(container.textContent).not.toContain("JOB-CURRENT");

    await act(async () => {
      pendingJobs?.resolve({ jobs: [nextJob], unscheduledCount: 0 });
    });

    await vi.waitFor(() => {
      expect(container.textContent).not.toContain("Loading calendar");
    });
    expect(container.textContent).toContain(nextMonthTitle);
  });

  it("lifts the loading state and shows the error note when a range fetch fails", async () => {
    pendingJobs = deferred<JobsPayload>();
    const container = await render(createElement(CalendarScreen));

    await vi.waitFor(() => {
      expect(container.textContent).toContain("JOB-CURRENT");
    });

    await act(async () => {
      nextMonthButton(container)?.click();
    });
    expect(container.textContent).toContain("Loading calendar");

    await act(async () => {
      pendingJobs?.reject(new Error("network down"));
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Jobs could not be loaded for this period.");
    });
    expect(container.textContent).not.toContain("Loading calendar");
    // The failure keeps the previous jobs on screen alongside the note,
    // exactly as it did before the loading state was added.
    expect(container.textContent).toContain("JOB-CURRENT");
  });
});
