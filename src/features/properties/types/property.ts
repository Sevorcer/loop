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
  /** Resolved customer display name. */
  customer: string;
  /** Supabase UUID of the linked customer record, when one exists. */
  customerId?: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
  openJobs: number;
  lastVisit: string;
  createdAt: string;

  /** Enriched location data derived from the saved address during create/update. */
  location?: PropertyLocation;
}