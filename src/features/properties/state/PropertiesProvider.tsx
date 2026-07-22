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

import type { Property, PropertyStatus, PropertyType } from "../types/property";

interface CreatePropertyInput {
  name: string;
  customer: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
}

interface PropertiesContextValue {
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  properties: Property[];
  getPropertyById: (id: string) => Property | undefined;
  refreshProperties: () => Promise<void>;
  reload: () => Promise<void>;
  createProperty: (input: CreatePropertyInput) => Promise<Property>;
}

const PropertiesContext = createContext<PropertiesContextValue | null>(null);

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [properties, setProperties] = useState<Property[]>([]);
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
      const response = await requestJson<{ properties: Property[] }>("/api/properties", {
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

    async function createProperty(input: CreatePropertyInput): Promise<Property> {
      const response = await requestJson<{ property: Property }>("/api/properties", {
        method: "POST",
        body: input,
      });

      setProperties((current) => [response.property, ...current]);
      return response.property;
    }

    async function reload() {
      await refreshProperties();
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
