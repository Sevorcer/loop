"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { todayLocalISODate } from "@/lib/dates";
import type {
  VehicleAlert,
  VehicleAlertPriority,
  VehicleAlertStatus,
} from "../types/vehicleAlert";

export interface CreateVehicleAlertInput {
  /** Picked vehicle; when set the server uses its name. */
  vehicleId?: string | null;
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

const VehicleAlertsContext = createContext<VehicleAlertsContextValue | null>(null);

export function VehicleAlertsProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;

    async function load() {
      try {
        const result = await requestJson<{ alerts: VehicleAlert[] }>(
          "/api/vehicle-alerts",
          { role, cache: "no-store" },
        );
        if (cancelled) return;
        setAlerts(Array.isArray(result.alerts) ? result.alerts : []);
      } catch {
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const createAlert = useCallback(
    (input: CreateVehicleAlertInput): VehicleAlert => {
      const optimistic: VehicleAlert = {
        id: `pending-${crypto.randomUUID()}`,
        vehicleId: input.vehicleId ?? null,
        vehicleName: input.vehicleName.trim(),
        title: input.title.trim(),
        description: input.description.trim(),
        priority: input.priority,
        status: "New",
        // Display name from the form until the server responds with the profile name.
        reportedBy: input.reportedBy.trim(),
        reportedAt: todayLocalISODate(),
      };

      setAlerts((current) => [optimistic, ...current]);

      void (async () => {
        try {
          const result = await requestJson<{ alert: VehicleAlert }>(
            "/api/vehicle-alerts",
            {
              method: "POST",
              role,
              body: {
                vehicleId: optimistic.vehicleId ?? undefined,
                vehicleName: optimistic.vehicleName,
                title: optimistic.title,
                description: optimistic.description,
                priority: optimistic.priority,
                // reportedBy is intentionally NOT sent — server sets reported_by from session
              },
            },
          );
          setAlerts((current) =>
            current.map((alert) =>
              alert.id === optimistic.id ? result.alert : alert,
            ),
          );
        } catch {
          setAlerts((current) =>
            current.filter((alert) => alert.id !== optimistic.id),
          );
        }
      })();

      return optimistic;
    },
    [role],
  );

  const updateAlertStatus = useCallback(
    (id: string, status: VehicleAlertStatus) => {
      let previousStatus: VehicleAlertStatus | null = null;

      setAlerts((current) =>
        current.map((alert) => {
          if (alert.id !== id) return alert;
          previousStatus = alert.status;
          return { ...alert, status };
        }),
      );

      void (async () => {
        try {
          const result = await requestJson<{ alert: VehicleAlert }>(
            `/api/vehicle-alerts/${id}`,
            {
              method: "PATCH",
              role,
              body: { status },
            },
          );
          setAlerts((current) =>
            current.map((alert) => (alert.id === id ? result.alert : alert)),
          );
        } catch {
          if (previousStatus) {
            const revertTo = previousStatus;
            setAlerts((current) =>
              current.map((alert) =>
                alert.id === id ? { ...alert, status: revertTo } : alert,
              ),
            );
          }
        }
      })();
    },
    [role],
  );

  const value = useMemo<VehicleAlertsContextValue>(
    () => ({ hydrated, alerts, createAlert, updateAlertStatus }),
    [hydrated, alerts, createAlert, updateAlertStatus],
  );

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
