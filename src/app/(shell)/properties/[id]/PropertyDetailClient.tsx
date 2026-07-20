"use client";

import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import { useProperties } from "@/features/properties/state/PropertiesProvider";

interface PropertyDetailClientProps {
  id: string;
}

export function PropertyDetailClient({ id }: PropertyDetailClientProps) {
  const { hydrated, properties } = useProperties();
  const property = properties.find((entry) => entry.id === id);

  if (!hydrated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading property details...
      </div>
    );
  }

  if (!property) {
    notFound();
  }

  return <PropertyDetailScreen property={property} />;
}
