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

import type { Property } from "../types/property";

type CreatePropertyInput = {
  name: string;
  customer: string;
  address: string;
  city: string;
  type: string;
  status: string;
  primarySystem: string;
};

type PropertiesStoreValue = {
  properties: Property[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  getPropertyById: (id: string) => Property | undefined;
  createProperty: (input: CreatePropertyInput) => Promise<Property>;
  refreshProperties: () => Promise<void>;
  reload: () => Promise<void>;
};

const PropertiesContext = createContext<PropertiesStoreValue | null>(null);

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProperties = useCallback(async () => {
    if (!role) return;

    setLoading(true);
    try {
      setError(null);

      const response = await requestJson<{ properties: Property[] }>("/api/properties", {
        role,
        cache: "no-store",
      });

      setProperties(Array.isArray(response.properties) ? response.properties : []);
    } catch (loadError) {
      setProperties([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load properties.");
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

  const value = useMemo<PropertiesStoreValue>(() => {
    function getPropertyById(id: string) {
      return properties.find((property) => property.id === id);
    }

    async function reload() {
      await refreshProperties();
    }

    async function createProperty(input: CreatePropertyInput) {
      const response = await requestJson<{ property: Property }>("/api/properties", {
        method: "POST",
        role,
        body: input,
      });

      setProperties((current) => [response.property, ...current]);
      return response.property;
    }

    return {
      properties,
      hydrated,
      loading,
      error,
      getPropertyById,
      createProperty,
      refreshProperties,
      reload,
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