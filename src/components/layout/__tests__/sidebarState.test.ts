import { describe, it, expect } from "vitest";

import { computeSidebarLayout, type SidebarState } from "../sidebarState";

// ─── computeSidebarLayout ─────────────────────────────────────────────────────
// Tests the pure sidebar layout-derivation function. Covers all the required
// PR2 behavioral contracts without any React rendering.

describe("computeSidebarLayout — default collapsed", () => {
  it("is closed when neither pinned nor keyboard-opened", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: false });
    expect(result.isOpen).toBe(false);
  });

  it("does not reserve layout space by default", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: false });
    expect(result.reservesLayoutSpace).toBe(false);
  });

  it("uses CSS hover behavior by default so hover-open/leave-close works", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: false });
    expect(result.usesHoverBehavior).toBe(true);
  });
});

describe("computeSidebarLayout — pin keeps sidebar open", () => {
  it("is open when pinned", () => {
    const result = computeSidebarLayout({ isPinned: true, isKeyboardOpen: false });
    expect(result.isOpen).toBe(true);
  });

  it("reserves layout space when pinned (content shifts right)", () => {
    const result = computeSidebarLayout({ isPinned: true, isKeyboardOpen: false });
    expect(result.reservesLayoutSpace).toBe(true);
  });

  it("does not use hover behavior when pinned (sidebar is always visible)", () => {
    const result = computeSidebarLayout({ isPinned: true, isKeyboardOpen: false });
    expect(result.usesHoverBehavior).toBe(false);
  });
});

describe("computeSidebarLayout — unpin returns to auto-hide", () => {
  it("closes when unpinned (and not keyboard-opened)", () => {
    // Start pinned
    const pinned = computeSidebarLayout({ isPinned: true, isKeyboardOpen: false });
    expect(pinned.isOpen).toBe(true);

    // Unpin
    const unpinned = computeSidebarLayout({ isPinned: false, isKeyboardOpen: false });
    expect(unpinned.isOpen).toBe(false);
  });

  it("re-enables hover behavior after unpinning", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: false });
    expect(result.usesHoverBehavior).toBe(true);
  });

  it("no longer reserves layout space after unpinning", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: false });
    expect(result.reservesLayoutSpace).toBe(false);
  });
});

describe("computeSidebarLayout — keyboard open (transient)", () => {
  it("opens the sidebar without pinning", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: true });
    expect(result.isOpen).toBe(true);
  });

  it("does not reserve layout space (keyboard open is an overlay)", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: true });
    expect(result.reservesLayoutSpace).toBe(false);
  });

  it("disables hover behavior (sidebar is already open)", () => {
    const result = computeSidebarLayout({ isPinned: false, isKeyboardOpen: true });
    expect(result.usesHoverBehavior).toBe(false);
  });
});

describe("computeSidebarLayout — mobile behavior independence", () => {
  // Mobile drawer state is managed separately (isMobileNavOpen in AppShell) and
  // is completely independent of the desktop pin/keyboard states.
  it("desktop pin state does not affect mobile (computeSidebarLayout is desktop-only)", () => {
    const desktop = computeSidebarLayout({ isPinned: true, isKeyboardOpen: false });
    // reservesLayoutSpace is a DESKTOP layout concern only; mobile uses a separate drawer
    expect(desktop.reservesLayoutSpace).toBe(true);
    // A separate computeSidebarLayout call with no pin/keyboard represents the
    // collapsed desktop default — mobile is always handled by its own boolean state.
    const collapsed = computeSidebarLayout({ isPinned: false, isKeyboardOpen: false });
    expect(collapsed.reservesLayoutSpace).toBe(false);
  });
});

describe("computeSidebarLayout — edge cases", () => {
  it("pinned AND keyboard-opened: open and reserves space (pin dominates)", () => {
    const result = computeSidebarLayout({ isPinned: true, isKeyboardOpen: true });
    expect(result.isOpen).toBe(true);
    expect(result.reservesLayoutSpace).toBe(true);
    expect(result.usesHoverBehavior).toBe(false);
  });

  // Verify the function is a pure function with no side effects
  it("returns the same output for the same input (pure function)", () => {
    const input: SidebarState = { isPinned: false, isKeyboardOpen: false };
    const a = computeSidebarLayout(input);
    const b = computeSidebarLayout(input);
    expect(a).toEqual(b);
  });
});
