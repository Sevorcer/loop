"use client";

import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import { useProperties } from "@/features/properties/state/PropertiesProvider";

interface PropertyDetailClientProps {
  id: string;
}

export function PropertyDetailClient({ id }: PropertyDetailClientProps) {
  const { properties } = useProperties();
  const property = properties.find((entry) => entry.id === id);

  if (!property) {
    notFound();
  }

  return <PropertyDetailScreen property={property} />;
}
