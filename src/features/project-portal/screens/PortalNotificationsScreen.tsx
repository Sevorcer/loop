"use client";

import { NotificationPreferencesPanel } from "../components/NotificationPreferences";

export function PortalNotificationsScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Notification Preferences</h1>
        <p className="mt-1 text-sm text-slate-400">
          Choose how you&apos;d like to be notified about your project updates.
        </p>
      </div>

      <NotificationPreferencesPanel />
    </div>
  );
}
