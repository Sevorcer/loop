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

import type {
  CreatePropertyInput,
  PropertiesContextValue,
  PropertyRecord,
} from "../types";

const PropertiesContext = createContext<PropertiesContextValue | null>(null);

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProperties = useCallback(async () => {
    if (!role) {
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const response = await requestJson<{ properties: PropertyRecord[] }>("/api/properties", {
        role,
        cache: "no-store",
      });
      setProperties(response.properties);
    } catch (loadError) {
      setProperties([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load properties.");
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, [role]);

  useEffect(() => {
    if (!role) {
      return;
    }

    queueMicrotask(() => {
      void refreshProperties();
    });
  }, [refreshProperties, role]);

  const value = useMemo<PropertiesContextValue>(() => {
    function getPropertyById(id: string) {
      return properties.find((property) => property.id === id);
    }

    async function reload() {
      await refreshProperties();
    }

    async function createProperty(input: CreatePropertyInput) {
      const response = await requestJson<{ property: PropertyRecord }>("/api/properties", {
        method: "POST",
        role,
        body: input,
      });

      setProperties((current) => [response.property, ...current]);
      return response.property;
    }

    return {
      hydrated,
      loading,
      error,
      properties,
      getPropertyById,
      refreshProperties,
      reload,
      createProperty,
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