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

import { mockProperties } from "../data/mockProperties";
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
  getPropertyById: (id: string) => Property | undefined;
  createProperty: (input: CreatePropertyInput) => Property;
}

const PROPERTIES_STORAGE_KEY = "loop.properties.items";
const subscribeToHydration = (onStoreChange: () => void) => {
  void onStoreChange;
  return () => {};
};

function parseStoredValue<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createPropertyId(index: number) {
  return `property-${String(index).padStart(3, "0")}`;
}

const PropertiesContext = createContext<PropertiesContextValue | null>(null);

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>(() => {
    if (typeof window === "undefined") {
      return mockProperties;
    }

    return parseStoredValue<Property[]>(
      window.localStorage.getItem(PROPERTIES_STORAGE_KEY),
      mockProperties
    );
  });
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      PROPERTIES_STORAGE_KEY,
      JSON.stringify(properties)
    );
  }, [hydrated, properties]);

  const value = useMemo<PropertiesContextValue>(() => {
    function getPropertyById(id: string) {
      return properties.find((property) => property.id === id);
    }

    function createProperty(input: CreatePropertyInput) {
      const nextIndex = properties.length + 1;
      const timestamp = new Date().toISOString();

      const newProperty: Property = {
        id: createPropertyId(nextIndex),
        name: input.name,
        customer: input.customer,
        address: input.address,
        city: input.city,
        type: input.type,
        status: input.status,
        primarySystem: input.primarySystem,
        openJobs: 0,
        lastVisit: timestamp.slice(0, 10),
        createdAt: timestamp,
      };

      setProperties((current) => [newProperty, ...current]);
      return newProperty;
    }

    return {
      hydrated,
      properties,
      getPropertyById,
      createProperty,
    };
  }, [hydrated, properties]);

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
