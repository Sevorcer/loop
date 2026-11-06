import { describe, expect, it } from "vitest";

import { categoryDepth, validateCategoryParent } from "../utils/categoryTree";

const tree = [
  { id: "hvac", parentId: null },
  { id: "elec", parentId: "hvac" },
  { id: "breakers", parentId: "elec" },
  { id: "plumb", parentId: null },
];

describe("categoryDepth", () => {
  it("counts roots as 1", () => {
    expect(categoryDepth("hvac", tree)).toBe(1);
    expect(categoryDepth("breakers", tree)).toBe(3);
  });
  it("flags a loop", () => {
    expect(categoryDepth("a", [{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("validateCategoryParent", () => {
  it("allows a root and a valid nesting", () => {
    expect(validateCategoryParent(null, null, tree)).toBeNull();
    expect(validateCategoryParent(null, "hvac", tree)).toBeNull();
    expect(validateCategoryParent("plumb", "hvac", tree)).toBeNull();
  });
  it("rejects an unknown parent, self-parent, and moving under a descendant", () => {
    expect(validateCategoryParent(null, "nope", tree)).toBe("Parent category not found.");
    expect(validateCategoryParent("hvac", "hvac", tree)).toBe("A category cannot be its own parent.");
    expect(validateCategoryParent("hvac", "breakers", tree)).toBe("A category cannot be moved under its own sub-category.");
  });
  it("rejects going deeper than 3 levels, including moving a subtree", () => {
    expect(validateCategoryParent(null, "breakers", tree)).toBe("Categories can be at most 3 levels deep.");
    // hvac subtree is 3 tall; putting it under plumb would make 4.
    expect(validateCategoryParent("hvac", "plumb", tree)).toBe("Categories can be at most 3 levels deep.");
  });
});
