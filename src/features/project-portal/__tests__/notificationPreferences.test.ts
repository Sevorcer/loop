/**
 * Notification preferences persistence tests.
 *
 * These tests validate the preference state model logic without
 * requiring a DOM or React runtime. The PortalProvider localStorage
 * persistence pattern mirrors CustomersProvider and VehicleAlertsProvider.
 */

import type { NotificationPreference, NotificationCategory, NotificationChannel } from "../types/portalTypes";
import { defaultNotificationPreferences } from "../data/mockPortalEvents";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyPreferenceUpdate(
  prefs: NotificationPreference[],
  category: NotificationCategory,
  channel: NotificationChannel,
  enabled: boolean
): NotificationPreference[] {
  return prefs.map((pref) => {
    if (pref.category !== category) return pref;
    return {
      ...pref,
      channels: pref.channels.map((ch) =>
        ch.channel === channel ? { ...ch, enabled } : ch
      ),
    };
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Notification preference state model", () => {
  it("default preferences exist for all 6 categories", () => {
    const categories = defaultNotificationPreferences.map((p) => p.category);
    expect(categories).toContain("appointment_reminder");
    expect(categories).toContain("inspection_scheduled");
    expect(categories).toContain("inspection_completed");
    expect(categories).toContain("change_order_approved");
    expect(categories).toContain("project_completed");
    expect(categories).toContain("warranty_available");
    expect(categories).toHaveLength(6);
  });

  it("each preference has all 4 channel entries", () => {
    for (const pref of defaultNotificationPreferences) {
      const channels = pref.channels.map((c) => c.channel);
      expect(channels).toContain("email");
      expect(channels).toContain("sms");
      expect(channels).toContain("push");
      expect(channels).toContain("in_app");
      expect(channels).toHaveLength(4);
    }
  });

  it("toggling a channel updates only that channel", () => {
    const initial = defaultNotificationPreferences;
    const appointmentPref = initial.find((p) => p.category === "appointment_reminder")!;
    const emailInitial = appointmentPref.channels.find((c) => c.channel === "email")!.enabled;

    const updated = applyPreferenceUpdate(initial, "appointment_reminder", "email", !emailInitial);

    const appointmentUpdated = updated.find((p) => p.category === "appointment_reminder")!;
    expect(appointmentUpdated.channels.find((c) => c.channel === "email")!.enabled).toBe(!emailInitial);

    // Other channels on the same pref are unchanged
    const smsChannel = appointmentUpdated.channels.find((c) => c.channel === "sms")!;
    const originalSms = appointmentPref.channels.find((c) => c.channel === "sms")!;
    expect(smsChannel.enabled).toBe(originalSms.enabled);
  });

  it("toggling a channel does not affect other categories", () => {
    const initial = defaultNotificationPreferences;
    const updated = applyPreferenceUpdate(initial, "appointment_reminder", "sms", false);

    const otherPrefs = updated.filter((p) => p.category !== "appointment_reminder");
    const originalOtherPrefs = initial.filter((p) => p.category !== "appointment_reminder");

    for (let i = 0; i < otherPrefs.length; i++) {
      expect(otherPrefs[i]).toEqual(originalOtherPrefs[i]);
    }
  });

  it("immutability: applyPreferenceUpdate does not mutate the original array", () => {
    const initial = JSON.parse(JSON.stringify(defaultNotificationPreferences)) as NotificationPreference[];
    const snapshot = JSON.parse(JSON.stringify(initial));

    applyPreferenceUpdate(initial, "project_completed", "push", true);

    expect(initial).toEqual(snapshot);
  });

  it("applying the same update twice is idempotent", () => {
    const initial = defaultNotificationPreferences;
    const once = applyPreferenceUpdate(initial, "warranty_available", "email", true);
    const twice = applyPreferenceUpdate(once, "warranty_available", "email", true);

    const onceEmail = once.find((p) => p.category === "warranty_available")!.channels.find((c) => c.channel === "email")!.enabled;
    const twiceEmail = twice.find((p) => p.category === "warranty_available")!.channels.find((c) => c.channel === "email")!.enabled;
    expect(onceEmail).toBe(true);
    expect(twiceEmail).toBe(true);
  });
});
