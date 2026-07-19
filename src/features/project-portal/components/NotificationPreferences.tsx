"use client";

import { Bell, Mail, MessageSquare, Smartphone, Bell as InApp } from "lucide-react";

import type {
  NotificationPreference,
  NotificationCategory,
  NotificationChannel,
} from "../types/portalTypes";
import { usePortal } from "../state/PortalProvider";

// ─── Category Metadata ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  appointment_reminder: "Appointment Reminders",
  inspection_scheduled: "Inspection Scheduled",
  inspection_completed: "Inspection Completed",
  change_order_approved: "Change Order Approved",
  project_completed: "Project Completed",
  warranty_available: "Warranty Available",
};

const CATEGORY_DESCRIPTIONS: Record<NotificationCategory, string> = {
  appointment_reminder: "Reminders before your scheduled visits.",
  inspection_scheduled: "When an inspection is booked for your project.",
  inspection_completed: "When an inspection has been completed.",
  change_order_approved: "When an approved change order is ready for your review.",
  project_completed: "When your project reaches completion.",
  warranty_available: "When warranty documentation is available.",
};

const CATEGORY_ORDER: NotificationCategory[] = [
  "appointment_reminder",
  "inspection_scheduled",
  "inspection_completed",
  "change_order_approved",
  "project_completed",
  "warranty_available",
];

// ─── Channel Metadata ─────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  in_app: "In-App",
};

const CHANNEL_ICONS: Record<NotificationChannel, React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>> = {
  email: Mail,
  sms: MessageSquare,
  push: Smartphone,
  in_app: InApp,
};

const CHANNEL_ORDER: NotificationChannel[] = ["email", "sms", "push", "in_app"];

const CHANNEL_NOTE: Record<NotificationChannel, string> = {
  email: "Placeholder — delivery not active",
  sms: "Placeholder — delivery not active",
  push: "Placeholder — delivery not active",
  in_app: "Placeholder — delivery not active",
};

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ChannelToggleProps {
  channel: NotificationChannel;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  labelledBy: string;
}

function ChannelToggle({ channel, enabled, onChange, labelledBy }: ChannelToggleProps) {
  const Icon = CHANNEL_ICONS[channel];
  const label = CHANNEL_LABELS[channel];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-labelledby={labelledBy}
      aria-describedby={`${channel}-note`}
      onClick={() => onChange(!enabled)}
      className={[
        "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        enabled
          ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/40"
          : "bg-slate-800/50 text-slate-500 ring-1 ring-slate-700/50 hover:bg-slate-800",
      ].join(" ")}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
      <span id={`${channel}-note`} className="sr-only">
        {CHANNEL_NOTE[channel]}
      </span>
    </button>
  );
}

// ─── Preference Row ───────────────────────────────────────────────────────────

interface PreferenceRowProps {
  pref: NotificationPreference;
  onChannelChange: (channel: NotificationChannel, enabled: boolean) => void;
}

function PreferenceRow({ pref, onChannelChange }: PreferenceRowProps) {
  const labelId = `notif-label-${pref.category}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:gap-6">
      {/* Label */}
      <div className="flex-1 min-w-0">
        <p id={labelId} className="font-medium text-white">
          {CATEGORY_LABELS[pref.category]}
        </p>
        <p className="mt-0.5 text-sm text-slate-400">
          {CATEGORY_DESCRIPTIONS[pref.category]}
        </p>
      </div>

      {/* Channels */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby={labelId}
      >
        {CHANNEL_ORDER.map((channel) => {
          const channelPref = pref.channels.find((c) => c.channel === channel);
          if (!channelPref) return null;
          return (
            <ChannelToggle
              key={channel}
              channel={channel}
              enabled={channelPref.enabled}
              onChange={(enabled) => onChannelChange(channel, enabled)}
              labelledBy={labelId}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Notification preferences panel (Sprint 22B).
 *
 * Channel placeholders only — no outbound delivery.
 * Preferences are persisted to localStorage via PortalProvider.
 */
export function NotificationPreferencesPanel() {
  const { notificationPreferences, updateNotificationPreference } = usePortal();

  const orderedPrefs = CATEGORY_ORDER.map((cat) =>
    notificationPreferences.find((p) => p.category === cat)
  ).filter((p): p is NotificationPreference => p !== undefined);

  return (
    <div className="space-y-4" aria-label="Notification preferences">
      {/* Header note */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
        <Bell size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" />
        <p className="text-sm text-slate-400">
          Notification delivery is not yet active. Preferences saved here will
          take effect when notification channels are enabled.
        </p>
      </div>

      {/* Preference rows */}
      <div className="space-y-3">
        {orderedPrefs.map((pref) => (
          <PreferenceRow
            key={pref.category}
            pref={pref}
            onChannelChange={(channel, enabled) =>
              updateNotificationPreference(pref.category, channel, enabled)
            }
          />
        ))}
      </div>
    </div>
  );
}
