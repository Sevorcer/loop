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
  properties: Property[];
  error: string | null;
  getPropertyById: (id: string) => Property | undefined;
  createProperty: (input: CreatePropertyInput) => Promise<Property>;
  reload: () => Promise<void>;
}

const PropertiesContext = createContext<PropertiesContextValue | null>(null);

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [properties, setProperties] = useState<Property[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    if (!role) {
      return;
    }

    try {
      setError(null);
      const response = await requestJson<{ properties: Property[] }>("/api/properties", {
        role,
        cache: "no-store",
      });
      setProperties(response.properties);
    } catch (loadError) {
      setProperties([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load properties.");
    } finally {
      setHydrated(true);
    }
  }, [role]);

  useEffect(() => {
    if (!role) {
      return;
    }

    void loadProperties();
  }, [loadProperties, role]);

  const value = useMemo<PropertiesContextValue>(() => {
    function getPropertyById(id: string) {
      return properties.find((property) => property.id === id);
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

    async function reload() {
      await loadProperties();
    }

    return {
      hydrated,
      properties,
      error,
      getPropertyById,
      createProperty,
      reload,
    };
  }, [error, hydrated, loadProperties, properties, role]);

  return (
    <PropertiesContext.Provider value={value}>
      {children}
    </PropertiesContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertiesContext);

  if (!context) {
    throw new Error("useProperties must be used within a PropertiesProvider");
  }

  return context;
}
