import { describe, expect, it } from "vitest";

import { resolveReportingUiState } from "../utils/uiState";

describe("resolveReportingUiState", () => {
  it("returns loading when the models request is pending", () => {
    expect(
      resolveReportingUiState({ loading: true, error: null, modelCount: 0 }),
    ).toBe("loading");
  });

  it("returns error when the models request fails", () => {
    expect(
      resolveReportingUiState({
        loading: false,
        error: "Unable to load models.",
        modelCount: 0,
      }),
    ).toBe("error");
  });

  it("returns empty when no models are available", () => {
    expect(
      resolveReportingUiState({ loading: false, error: null, modelCount: 0 }),
    ).toBe("empty");
  });

  it("returns ready when at least one model exists", () => {
    expect(
      resolveReportingUiState({ loading: false, error: null, modelCount: 1 }),
    ).toBe("ready");
  });
});
