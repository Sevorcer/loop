"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { mockVehicleAlerts } from "../data/mockVehicleAlerts";
import { todayLocalISODate } from "@/lib/dates";
import type {
  VehicleAlert,
  VehicleAlertPriority,
  VehicleAlertStatus,
} from "../types/vehicleAlert";

export interface CreateVehicleAlertInput {
  vehicleName: string;
  title: string;
  description: string;
  reportedBy: string;
  priority: VehicleAlertPriority;
}

interface VehicleAlertsContextValue {
  hydrated: boolean;
  alerts: VehicleAlert[];
  createAlert: (input: CreateVehicleAlertInput) => VehicleAlert;
  updateAlertStatus: (id: string, status: VehicleAlertStatus) => void;
}

const VEHICLE_ALERTS_STORAGE_KEY = "loop.vehicle-alerts.items";

// useSyncExternalStore requires a subscribe function. We use a no-op here
// because hydration is a one-time server→client transition — there is no
// external store to subscribe to. The snapshot function returns `true` on
// the client and `false` on the server, so the initial client render picks
// up the correct hydrated flag without any ongoing subscription.
const subscribeToHydration = (onStoreChange: () => void) => {
  void onStoreChange;
  return () => {};
};

function parseStoredValue<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const VehicleAlertsContext = createContext<VehicleAlertsContextValue | null>(null);

export function VehicleAlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<VehicleAlert[]>(() => {
    if (typeof window === "undefined") return mockVehicleAlerts;
    return parseStoredValue<VehicleAlert[]>(
      window.localStorage.getItem(VEHICLE_ALERTS_STORAGE_KEY),
      mockVehicleAlerts
    );
  });

  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(VEHICLE_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  }, [hydrated, alerts]);

  const value = useMemo<VehicleAlertsContextValue>(() => {
    function createAlert(input: CreateVehicleAlertInput): VehicleAlert {
      const newAlert: VehicleAlert = {
        id: `VA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        vehicleName: input.vehicleName.trim(),
        title: input.title.trim(),
        description: input.description.trim(),
        priority: input.priority,
        status: "New",
        reportedBy: input.reportedBy.trim(),
        reportedAt: todayLocalISODate(),
      };
      setAlerts((current) => [newAlert, ...current]);
      return newAlert;
    }

    function updateAlertStatus(id: string, status: VehicleAlertStatus) {
      setAlerts((current) =>
        current.map((alert) => (alert.id === id ? { ...alert, status } : alert))
      );
    }

    return { hydrated, alerts, createAlert, updateAlertStatus };
  }, [hydrated, alerts]);

  return (
    <VehicleAlertsContext.Provider value={value}>
      {children}
    </VehicleAlertsContext.Provider>
  );
}

export function useVehicleAlerts() {
  const context = useContext(VehicleAlertsContext);
  if (!context) {
    throw new Error("useVehicleAlerts must be used within a VehicleAlertsProvider");
  }
  return context;
}
