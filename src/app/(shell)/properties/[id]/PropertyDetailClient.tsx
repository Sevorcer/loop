"use client";

import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import { useProperties } from "@/features/properties/state/PropertiesProvider";

interface PropertyDetailClientProps {
  id: string;
}

export function PropertyDetailClient({ id }: PropertyDetailClientProps) {
  const { properties, loading, hydrated, error } = useProperties();

  if (loading || !hydrated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading property details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    );
  }

  const property = properties.find((entry) => entry.id === id);

  if (!property) {
    notFound();
  }

  return <PropertyDetailScreen property={property} />;
}
