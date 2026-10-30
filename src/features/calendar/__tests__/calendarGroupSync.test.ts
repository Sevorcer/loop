// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { CALENDAR_PEOPLE_GROUPS_KEY } from "../utils/calendarPeopleFilter";
import {
  clearLocalCalendarGroups,
  groupSignature,
  readLocalCalendarGroups,
  releaseGroupImport,
  resetGroupImportClaims,
  takeGroupsToImport,
  type CalendarQuickGroup,
} from "../utils/calendarGroupSync";

const localGroup: CalendarQuickGroup = {
  id: "local-1",
  name: "Install",
  personIds: ["brian", "alex"],
};

afterEach(() => {
  resetGroupImportClaims();
  localStorage.removeItem(CALENDAR_PEOPLE_GROUPS_KEY);
});

describe("shared calendar group import", () => {
  it("claims a local group once so a second load does not duplicate it", () => {
    const first = takeGroupsToImport([localGroup], []);
    const second = takeGroupsToImport([localGroup], []);
    expect(first).toEqual([localGroup]);
    expect(second).toEqual([]);
  });

  it("skips a group the office already has, ignoring id and person order", () => {
    const remote: CalendarQuickGroup[] = [
      { id: "server-1", name: "Install", personIds: ["alex", "brian"] },
    ];
    expect(takeGroupsToImport([localGroup], remote)).toEqual([]);
    expect(groupSignature(localGroup)).toBe(groupSignature(remote[0]));
  });

  it("releases a failed import so it can be tried again", () => {
    const [claimed] = takeGroupsToImport([localGroup], []);
    releaseGroupImport(claimed);
    expect(takeGroupsToImport([localGroup], [])).toEqual([localGroup]);
  });

  it("reads and clears the browser copy", () => {
    localStorage.setItem(CALENDAR_PEOPLE_GROUPS_KEY, JSON.stringify([localGroup]));
    expect(readLocalCalendarGroups()).toEqual([localGroup]);
    clearLocalCalendarGroups();
    expect(readLocalCalendarGroups()).toEqual([]);
  });
});
