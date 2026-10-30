// @vitest-environment happy-dom
import {
  act,
  createElement,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/features/jobs/state/JobsProvider", () => ({
  useJobs: () => ({ hydrated: true, jobs: [] }),
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

import {
  CalendarScreen,
  readCalendarViewServer,
  readCalendarViewSnapshot,
  readGroupsServer,
  readPeopleServer,
  readStoredGroups,
  readStoredPeople,
} from "../screens/CalendarScreen";

const roots: Root[] = [];

function subscribeStore() {
  return () => {};
}

function PeopleStoreProbe() {
  const people = useSyncExternalStore(subscribeStore, readStoredPeople, readPeopleServer);
  const groups = useSyncExternalStore(subscribeStore, readStoredGroups, readGroupsServer);
  const peopleLabel = people === "pending" ? "pending" : people.join(",");
  const groupsLabel = groups === "pending" ? "pending" : String(groups.length);
  return createElement("p", null, `${peopleLabel}|${groupsLabel}`);
}

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

beforeEach(() => {
  authState.role = "owner";
  requestJson.mockImplementation(async (url: string, options?: { method?: string; body?: { name?: string; personIds?: string[] } }) => {
    const path = String(url);
    if (path.includes("/api/calendar/groups")) {
      if (options?.method === "POST") {
        return {
          group: {
            id: "saved-group",
            name: options.body?.name ?? "Group",
            personIds: options.body?.personIds ?? [],
          },
        };
      }
      return { groups: [] };
    }
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
});

describe("calendar snapshot readers", () => {
  it("returns the same people array while localStorage is unchanged", () => {
    localStorage.setItem(CALENDAR_PEOPLE_STORAGE_KEY, JSON.stringify(["brian", "sean", "brian"]));

    const first = readStoredPeople();
    const second = readStoredPeople();

    expect(second).toBe(first);
    expect(first).toEqual(["brian", "sean"]);
  });

  it("returns the same groups array while localStorage is unchanged", () => {
    localStorage.setItem(
      CALENDAR_PEOPLE_GROUPS_KEY,
      JSON.stringify([{ id: "g1", name: "Install crew", personIds: ["brian", "sean"] }]),
    );

    const first = readStoredGroups();
    const second = readStoredGroups();

    expect(second).toBe(first);
    expect(first).toEqual([{ id: "g1", name: "Install crew", personIds: ["brian", "sean"] }]);
  });

  it("reuses one empty array when nothing valid is saved", () => {
    const missingPeople = readStoredPeople();
    const missingPeopleAgain = readStoredPeople();
    localStorage.setItem(CALENDAR_PEOPLE_STORAGE_KEY, "nope");
    const invalidPeople = readStoredPeople();

    expect(missingPeopleAgain).toBe(missingPeople);
    expect(invalidPeople).toBe(missingPeople);
    expect(missingPeople).toEqual([]);

    const missingGroups = readStoredGroups();
    const missingGroupsAgain = readStoredGroups();
    localStorage.setItem(CALENDAR_PEOPLE_GROUPS_KEY, "nope");
    const invalidGroups = readStoredGroups();

    expect(missingGroupsAgain).toBe(missingGroups);
    expect(invalidGroups).toBe(missingGroups);
    expect(missingGroups).toEqual([]);
  });

  it("returns a new array only after the stored text changes", () => {
    localStorage.setItem(CALENDAR_PEOPLE_STORAGE_KEY, JSON.stringify(["brian"]));
    const brian = readStoredPeople();
    localStorage.setItem(CALENDAR_PEOPLE_STORAGE_KEY, JSON.stringify(["sean"]));
    const sean = readStoredPeople();

    expect(sean).not.toBe(brian);
    expect(readStoredPeople()).toBe(sean);
    expect(sean).toEqual(["sean"]);
  });

  it("returns the empty constant when storage throws", () => {
    const original = window.localStorage;
    let reads = 0;
    const blocked = {
      getItem() {
        reads += 1;
        throw new Error("storage blocked");
      },
      setItem() {},
      removeItem() {},
      clear() {},
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: blocked });
    try {
      const people = readStoredPeople();
      const groups = readStoredGroups();
      expect(readStoredPeople()).toBe(people);
      expect(readStoredGroups()).toBe(groups);
      expect(people).toEqual([]);
      expect(groups).toEqual([]);
      expect(reads).toBe(4);
    } finally {
      Object.defineProperty(window, "localStorage", { configurable: true, value: original });
    }
  });

  it("keeps server snapshots and the view snapshot stable", () => {
    localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, "week");
    window.history.replaceState(null, "", "/calendar?view=week");

    expect(readPeopleServer()).toBe(readPeopleServer());
    expect(readGroupsServer()).toBe(readGroupsServer());
    expect(readCalendarViewServer()).toBe(readCalendarViewServer());
    expect(readCalendarViewSnapshot()).toBe("week");
    expect(readCalendarViewSnapshot()).toBe(readCalendarViewSnapshot());
  });
});

describe("calendar screen store render", () => {
  it("mounts the people store with empty and saved filters", async () => {
    localStorage.removeItem(CALENDAR_PEOPLE_STORAGE_KEY);
    localStorage.removeItem(CALENDAR_PEOPLE_GROUPS_KEY);
    const empty = await render(createElement(PeopleStoreProbe));
    expect(empty.textContent).toBe("|0");

    localStorage.setItem(CALENDAR_PEOPLE_STORAGE_KEY, JSON.stringify(["brian", "sean"]));
    localStorage.setItem(
      CALENDAR_PEOPLE_GROUPS_KEY,
      JSON.stringify([{ id: "g1", name: "Install crew", personIds: ["brian"] }]),
    );
    const saved = await render(createElement(PeopleStoreProbe));
    expect(saved.textContent).toBe("brian,sean|1");
  });

  it("mounts the calendar with empty storage", async () => {
    localStorage.removeItem(CALENDAR_PEOPLE_STORAGE_KEY);
    localStorage.removeItem(CALENDAR_PEOPLE_GROUPS_KEY);

    const container = await render(createElement(CalendarScreen));

    expect(container.textContent).toContain("Calendar");
  });

  it("mounts the calendar with a saved person filter and shares the local group", async () => {
    localStorage.setItem(CALENDAR_PEOPLE_STORAGE_KEY, JSON.stringify(["brian", "alex"]));
    localStorage.setItem(
      CALENDAR_PEOPLE_GROUPS_KEY,
      JSON.stringify([{ id: "g1", name: "Install crew", personIds: ["brian", "alex"] }]),
    );

    const container = await render(createElement(CalendarScreen));

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Install crew");
    });
    expect(container.textContent).toContain("Calendar");
    expect(localStorage.getItem(CALENDAR_PEOPLE_GROUPS_KEY)).toBeNull();
    expect(requestJson).toHaveBeenCalledWith(
      "/api/calendar/groups",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the shared group controls before anyone is selected", async () => {
    const container = await render(createElement(CalendarScreen));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Shared groups");
    });
    expect(container.textContent).toContain("save a group");
    expect(container.querySelector("[data-calendar-shared-groups]")).not.toBeNull();
  });

  it("saves the selected people as a shared group", async () => {
    requestJson.mockImplementation(async (url: string, options?: { method?: string; body?: { name?: string; personIds?: string[] } }) => {
      const path = String(url);
      if (path.includes("/api/calendar/team")) {
        return {
          team: [
            { id: "antonio", name: "Antonio Vilchez" },
            { id: "brian", name: "Brian Ramirez" },
          ],
        };
      }
      if (path.includes("/api/calendar/groups") && options?.method === "POST") {
        return {
          group: {
            id: "saved-group",
            name: options.body?.name ?? "Group",
            personIds: options.body?.personIds ?? [],
          },
        };
      }
      if (path.includes("/api/calendar/groups")) return { groups: [] };
      return { timeOff: [], tasks: [] };
    });

    const container = await render(createElement(CalendarScreen));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Antonio Vilchez");
    });

    const buttonNamed = (name: string) =>
      [...container.querySelectorAll("button")].find((button) => button.textContent === name);

    await act(async () => {
      buttonNamed("Antonio Vilchez")?.click();
    });
    await act(async () => {
      buttonNamed("Brian Ramirez")?.click();
    });
    await act(async () => {
      buttonNamed("Save group")?.click();
    });
    await act(async () => {
      container.querySelector("form")?.requestSubmit();
    });

    await vi.waitFor(() => {
      expect(requestJson).toHaveBeenCalledWith(
        "/api/calendar/groups",
        expect.objectContaining({
          method: "POST",
          body: {
            name: "Antonio Vilchez + Brian Ramirez",
            personIds: ["antonio", "brian"],
          },
        }),
      );
    });
    expect(container.textContent).toContain("Antonio Vilchez + Brian Ramirez");
  });

  it("shows a group stored for the office", async () => {
    requestJson.mockImplementation(async (url: string) => {
      const path = String(url);
      if (path.includes("/api/calendar/groups")) {
        return { groups: [{ id: "shared", name: "Morning route", personIds: ["alex"] }] };
      }
      if (path.includes("/api/calendar/team")) return { team: [] };
      return { timeOff: [], tasks: [] };
    });

    const container = await render(createElement(CalendarScreen));

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Morning route");
    });
  });

  it("does not show the people filter to a technician", async () => {
    authState.role = "tech";
    const container = await render(createElement(CalendarScreen));
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Calendar");
    });
    expect(container.textContent).not.toContain("Showing everyone");
    expect(container.textContent).not.toContain("Shared groups");
    expect(container.textContent).not.toContain("Save group");
  });
});
