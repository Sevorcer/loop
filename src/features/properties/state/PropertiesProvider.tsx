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
  createProperty: (input: CreatePropertyInput) => Promise<Property>;
}

const PropertiesContext = createContext<PropertiesContextValue | null>(null);

function getDevRole() {
  if (typeof window === "undefined") {
    return "owner";
  }

  return window.localStorage.getItem("loop_dev_role") ?? "owner";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-loop-role": getDevRole(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }

  return payload;
}

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestJson<{ properties: Property[] }>("/api/properties");
      setProperties(payload.properties);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load properties."
      );
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refreshProperties();
  }, [refreshProperties]);

  const value = useMemo<PropertiesContextValue>(() => {
    function getPropertyById(id: string) {
      return properties.find((property) => property.id === id);
    }

    async function createProperty(input: CreatePropertyInput): Promise<Property> {
      const payload = await requestJson<{ property: Property }>("/api/properties", {
        method: "POST",
        body: JSON.stringify(input),
      });

      setProperties((current) => [payload.property, ...current]);
      return payload.property;
    }

    return {
      hydrated,
      loading,
      error,
      properties,
      getPropertyById,
      refreshProperties,
      createProperty,
    };
  }, [error, hydrated, loading, properties, refreshProperties]);

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
