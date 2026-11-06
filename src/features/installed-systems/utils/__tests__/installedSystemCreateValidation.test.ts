import { describe, expect, it } from "vitest";

function serialNumbersFromInput(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((s) => typeof s === "string" && s.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function requiresSerial(serialNumbers: string[]): boolean {
  return serialNumbers.length === 0;
}

describe("installed system create serial gate", () => {
  it("rejects empty serial input", () => {
    expect(requiresSerial(serialNumbersFromInput(""))).toBe(true);
    expect(requiresSerial(serialNumbersFromInput([]))).toBe(true);
    expect(requiresSerial(serialNumbersFromInput(["  "]))).toBe(true);
  });

  it("accepts a trimmed serial", () => {
    expect(requiresSerial(serialNumbersFromInput("SN-1"))).toBe(false);
    expect(requiresSerial(serialNumbersFromInput([" SN-1 "]))).toBe(false);
  });
});
