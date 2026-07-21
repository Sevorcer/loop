import { describe, expect, it } from "vitest";

import { resolveCompanyBrainUiState } from "../utils/uiState";

describe("resolveCompanyBrainUiState", () => {
  it("returns loading while request is in flight", () => {
    expect(
      resolveCompanyBrainUiState({ loading: true, error: null, itemCount: 0 }),
    ).toBe("loading");
  });

  it("returns error when request fails", () => {
    expect(
      resolveCompanyBrainUiState({
        loading: false,
        error: "Unable to load.",
        itemCount: 0,
      }),
    ).toBe("error");
  });

  it("returns empty when load succeeds with no records", () => {
    expect(
      resolveCompanyBrainUiState({ loading: false, error: null, itemCount: 0 }),
    ).toBe("empty");
  });

  it("returns ready when records are available", () => {
    expect(
      resolveCompanyBrainUiState({ loading: false, error: null, itemCount: 3 }),
    ).toBe("ready");
  });
});
