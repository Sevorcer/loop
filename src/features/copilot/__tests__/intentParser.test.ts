import { describe, expect, it } from "vitest";

import { parseCopilotIntent } from "../intentParser";

describe("parseCopilotIntent", () => {
  it("classifies navigation intent", () => {
    expect(parseCopilotIntent("go to dispatch")).toBe("navigation");
  });

  it("classifies manual lookup intent", () => {
    expect(parseCopilotIntent("find MXZ-5D36NL manual")).toBe("manual_lookup");
  });

  it("classifies photo lookup intent", () => {
    expect(parseCopilotIntent("show me all site photos")).toBe("photo_lookup");
  });

  it("classifies conversational intent", () => {
    expect(parseCopilotIntent("How does dispatch efficiency work?")).toBe("conversation");
  });

  it("defaults to search intent", () => {
    expect(parseCopilotIntent("Weymuller")).toBe("search");
  });
});
