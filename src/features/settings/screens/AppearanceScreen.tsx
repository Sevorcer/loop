"use client";

/**
 * AppearanceScreen — user appearance preferences.
 *
 * All preferences are stored in localStorage and applied to the document
 * root via CSS custom properties / data attributes. No server round-trips.
 */

import { Check } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { SectionCard } from "@/components/atlas/SectionCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

import { useAppearancePreferences } from "../hooks/useAppearancePreferences";
import {
  hasSidebarNavOverride,
  resetSidebarNavOverride,
} from "../lib/appearancePreferences";
import type {
  AccentColor,
  ColorMode,
  SpacingMode,
  DashboardLayout,
  CommandCenterLayout,
} from "../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT_OPTIONS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "blue", label: "Blue", hex: "#3b82f6" },
  { value: "purple", label: "Purple", hex: "#a855f7" },
  { value: "green", label: "Green", hex: "#22c55e" },
  { value: "orange", label: "Orange", hex: "#f97316" },
  { value: "red", label: "Red", hex: "#ef4444" },
  { value: "cyan", label: "Cyan", hex: "#06b6d4" },
];

const LANDING_PAGE_OPTIONS: { value: string; label: string }[] = [
  { value: ROUTES.DASHBOARD, label: "Dashboard" },
  { value: ROUTES.COMMAND_CENTER, label: "Command Center" },
  { value: ROUTES.JOBS, label: "Jobs" },
  { value: ROUTES.OPERATIONS, label: "Operations" },
  { value: ROUTES.DAILY_PLANS, label: "Daily Plans" },
  { value: ROUTES.DISPATCH, label: "Dispatch" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 border-b border-slate-800 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-slate-700 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "px-3 py-1.5 text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-accent text-white"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function AppearanceScreen() {
  const { preferences, updatePreferences, resetPreferences } =
    useAppearancePreferences();
  const hasNavOverride = hasSidebarNavOverride(preferences);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appearance"
        description="Customize how LOOP looks and feels for you. Changes are saved locally to your browser."
      />

      {/* Theme section */}
      <SectionCard title="Theme">
        <PreferenceRow
          label="Color Mode"
          description="Choose between dark (default) and light workspace."
        >
          <ToggleGroup<ColorMode>
            value={preferences.colorMode}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(colorMode) => updatePreferences({ colorMode })}
          />
        </PreferenceRow>

        <PreferenceRow
          label="Accent Color"
          description="Sets the primary interactive color throughout the interface."
        >
          <div className="flex gap-2">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-label={`Set accent color to ${opt.label}`}
                title={opt.label}
                onClick={() => updatePreferences({ accentColor: opt.value })}
                className="relative h-7 w-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                style={{ backgroundColor: opt.hex }}
              >
                {preferences.accentColor === opt.value && (
                  <Check
                    size={12}
                    className="absolute inset-0 m-auto text-white drop-shadow-sm"
                  />
                )}
              </button>
            ))}
          </div>
        </PreferenceRow>
      </SectionCard>

      {/* Layout section */}
      <SectionCard title="Layout">
        <PreferenceRow
          label="Spacing Density"
          description="Comfortable spacing gives more breathing room; compact shows more data."
        >
          <ToggleGroup<SpacingMode>
            value={preferences.spacing}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
            onChange={(spacing) => updatePreferences({ spacing })}
          />
        </PreferenceRow>

        <PreferenceRow
          label="Dashboard Layout"
          description="Controls how the dashboard KPI cards and panels are arranged."
        >
          <ToggleGroup<DashboardLayout>
            value={preferences.dashboardLayout}
            options={[
              { value: "default", label: "Default" },
              { value: "condensed", label: "Condensed" },
              { value: "wide", label: "Wide" },
            ]}
            onChange={(dashboardLayout) => updatePreferences({ dashboardLayout })}
          />
        </PreferenceRow>

        <PreferenceRow
          label="Command Center Layout"
          description="Controls how metrics and panels are displayed in the Command Center."
        >
          <ToggleGroup<CommandCenterLayout>
            value={preferences.commandCenterLayout}
            options={[
              { value: "default", label: "Default" },
              { value: "focused", label: "Focused" },
            ]}
            onChange={(commandCenterLayout) =>
              updatePreferences({ commandCenterLayout })
            }
          />
        </PreferenceRow>
      </SectionCard>

      {/* Navigation section */}
      <SectionCard title="Navigation">
        <PreferenceRow
          label="Sidebar Pinned by Default"
          description="Keep the sidebar expanded when you open LOOP."
        >
          <ToggleGroup<"true" | "false">
            value={preferences.sidebarPinnedDefault ? "true" : "false"}
            options={[
              { value: "true", label: "Pinned" },
              { value: "false", label: "Auto-hide" },
            ]}
            onChange={(v) =>
              updatePreferences({ sidebarPinnedDefault: v === "true" })
            }
          />
        </PreferenceRow>

        <PreferenceRow
          label="Default Landing Page"
          description="The first page you see when you sign in."
        >
          <select
            value={preferences.defaultLandingPage}
            onChange={(e) =>
              updatePreferences({ defaultLandingPage: e.target.value })
            }
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            {LANDING_PAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </PreferenceRow>

        <PreferenceRow
          label="Role-Aware Sidebar Preset"
          description="Clear any custom sidebar ordering and restore the default emphasis for your role."
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => updatePreferences(resetSidebarNavOverride(preferences))}
            disabled={!hasNavOverride}
            className="text-slate-400 hover:text-slate-200 disabled:text-slate-600 disabled:hover:text-slate-600"
          >
            Reset to role default
          </Button>
        </PreferenceRow>
      </SectionCard>

      {/* Reset */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={resetPreferences}
          className="text-slate-400 hover:text-slate-200"
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
