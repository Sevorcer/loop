export type PropertyStatus = "Active" | "Pending" | "Inactive";

export type PropertyType = "Residential" | "Commercial" | "Multi-Family";

export interface PropertyLocation {
  latitude: number;
  longitude: number;
  /** Normalized address returned by the geocoding provider. */
  formattedAddress?: string;
  /** Stable place identifier from the geocoding provider. */
  placeId?: string;
}

export interface Property {
  id: string;
  name: string;
  customer: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
  openJobs: number;
  lastVisit: string;
  createdAt: string;

  /** Enriched location data populated automatically during create/update. */
  location?: PropertyLocation;
}