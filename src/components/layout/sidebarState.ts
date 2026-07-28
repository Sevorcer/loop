/**
 * Pure sidebar state utilities — no React dependencies.
 *
 * The desktop sidebar supports two open mechanisms:
 *  1. CSS hover (group-hover via Tailwind) — purely presentational, no JS state.
 *  2. JS-driven open: pinned (persistent) or keyboard-opened (transient).
 *
 * `computeSidebarLayout` derives the layout flags consumed by AppShell.
 */

export interface SidebarState {
  /** Whether the sidebar is pinned (persistent open, reserves layout space). */
  isPinned: boolean;
  /**
   * Whether the sidebar was opened via keyboard (transient — not pinned).
   * Independent of CSS hover state.
   */
  isKeyboardOpen: boolean;
}

export interface SidebarLayoutResult {
  /**
   * True when the sidebar is "fixed open" through JS state (pinned or
   * keyboard-opened). CSS hover may additionally open the sidebar without
   * affecting this flag.
   */
  isOpen: boolean;
  /**
   * True when the sidebar should reserve layout space by inserting a spacer
   * that pushes the main content to the right. Only true when pinned.
   */
  reservesLayoutSpace: boolean;
  /**
   * True when the sidebar should apply CSS hover classes so that hovering the
   * left-edge hot zone slides the sidebar in. False when the sidebar is already
   * fixed-open (no hover needed).
   */
  usesHoverBehavior: boolean;
}

export function computeSidebarLayout(state: SidebarState): SidebarLayoutResult {
  const isOpen = state.isPinned || state.isKeyboardOpen;
  return {
    isOpen,
    reservesLayoutSpace: state.isPinned,
    usesHoverBehavior: !isOpen,
  };
}

// ---------------------------------------------------------------------------
// localStorage helpers — reads/writes the sidebarPinnedDefault property from
// the shared appearance-preferences blob without coupling AppShell to the full
// useAppearancePreferences hook.
// ---------------------------------------------------------------------------

const PREFS_STORAGE_KEY = "loop_appearance_prefs";

/**
 * Synchronously reads the pinned preference from localStorage.
 * Safe to call in a useState lazy initializer (client-side only).
 */
export function readSidebarPinned(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const val = parsed.sidebarPinnedDefault;
    return typeof val === "boolean" ? val : false;
  } catch {
    return false;
  }
}

/**
 * Persists a new pinned value into the appearance-preferences blob in
 * localStorage without overwriting other keys.
 */
export function writeSidebarPinned(pinned: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ ...existing, sidebarPinnedDefault: pinned })
    );
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}
