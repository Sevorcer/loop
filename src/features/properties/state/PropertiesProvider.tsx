"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useCurrentRole } from "@/providers/current-role-provider";
import { requestJson } from "@/lib/api/client";
import type {
  CreatePropertyInput,
  PropertiesContextValue,
  PropertyRecord,
} from "@/features/properties/types";

const PropertiesContext = createContext<PropertiesContextValue | null>(null);

export function PropertiesProvider({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentRole();

  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProperties = useCallback(async () => {
    if (!role) return;

    setLoading(true);
    try {
      setError(null);

      const payload = await requestJson<{ properties: PropertyRecord[] }>("/api/properties", {
        cache: "no-store",
        role, // keep aligned with jobs provider behavior in non-prod
      });

      setProperties(payload.properties);
    } catch (err) {
      setProperties([]);
      setError(err instanceof Error ? err.message : "Failed to load properties.");
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, [role]);

  useEffect(() => {
    if (!role) return;

    queueMicrotask(() => {
      void refreshProperties();
    });
  }, [refreshProperties, role]);

  const value = useMemo<PropertiesContextValue>(() => {
    async function reload() {
      await refreshProperties();
    }

    return {
      hydrated,
      loading,
      error,
      properties,
      getPropertyById(id: string) {
        return properties.find((property) => property.id === id);
      },
      refreshProperties,
      reload,
      async createProperty(input: CreatePropertyInput) {
        const payload = await requestJson<{ property: PropertyRecord }>("/api/properties", {
          method: "POST",
          body: input,
          role, // keep aligned with jobs provider behavior in non-prod
        });

        setProperties((prev) => [payload.property, ...prev]);
        return payload.property;
      },
    };
  }, [error, hydrated, loading, properties, refreshProperties, role]);

  return <PropertiesContext.Provider value={value}>{children}</PropertiesContext.Provider>;
}

export function useProperties() {
  const context = useContext(PropertiesContext);
  if (!context) {
    throw new Error("useProperties must be used within a PropertiesProvider");
  }
  return context;
}