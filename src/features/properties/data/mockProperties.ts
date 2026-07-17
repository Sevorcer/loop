import type { Property, PropertyLocation } from "../types/property";
import { formatPropertyAddress } from "../utils/formatPropertyAddress";

type MockPropertySeed = Omit<Property, "location"> & {
  coordinates?: Pick<PropertyLocation, "latitude" | "longitude">;
};

/**
 * Mock data follows the same invariant as persisted data:
 * address/city are canonical, and any location metadata is derived from them.
 */
function createMockProperty({
  coordinates,
  ...property
}: MockPropertySeed): Property {
  if (!coordinates) {
    return property;
  }

  return {
    ...property,
    location: {
      ...coordinates,
      formattedAddress: formatPropertyAddress(property),
    },
  };
}

export const mockProperties: Property[] = [
  createMockProperty({
    id: "1",
    name: "Smith Residence",
    customer: "John Smith",
    address: "600 4th Ave",
    city: "Seattle",
    type: "Residential",
    status: "Active",
    primarySystem: "Mitsubishi Hyper Heat",
    openJobs: 1,
    lastVisit: "2026-06-28",
    createdAt: "2025-09-12",
    coordinates: {
      latitude: 47.6062,
      longitude: -122.3321,
    },
  }),
  createMockProperty({
    id: "2",
    name: "Johnson Residence",
    customer: "Sarah Johnson",
    address: "500 108th Ave NE",
    city: "Bellevue",
    type: "Residential",
    status: "Active",
    primarySystem: "Daikin VRV",
    openJobs: 3,
    lastVisit: "2026-07-02",
    createdAt: "2025-11-01",
    coordinates: {
      latitude: 47.6101,
      longitude: -122.2015,
    },
  }),
  createMockProperty({
    id: "3",
    name: "Evergreen Dental",
    customer: "Evergreen Dental Group",
    address: "1447 N 200th St",
    city: "Shoreline",
    type: "Commercial",
    status: "Pending",
    primarySystem: "Lennox RTU",
    openJobs: 2,
    lastVisit: "2026-05-18",
    createdAt: "2026-01-15",
    coordinates: {
      latitude: 47.7557,
      longitude: -122.3416,
    },
  }),
  createMockProperty({
    id: "4",
    name: "Lakeview Apartments",
    customer: "Lakeview Property Management",
    address: "7300 NE 175th St",
    city: "Kenmore",
    type: "Commercial",
    status: "Active",
    primarySystem: "Mitsubishi Ducted",
    openJobs: 0,
    lastVisit: "2026-06-12",
    createdAt: "2025-10-20",
    coordinates: {
      latitude: 47.7601,
      longitude: -122.2054,
    },
  }),
  createMockProperty({
    id: "5",
    name: "Brown Residence",
    customer: "Michael Brown",
    address: "8825 Rainier Ave S",
    city: "Seattle",
    type: "Residential",
    status: "Inactive",
    primarySystem: "Carrier Infinity",
    openJobs: 0,
    lastVisit: "2025-12-04",
    createdAt: "2024-08-16",
    coordinates: {
      latitude: 47.5189,
      longitude: -122.2995,
    },
  }),
  createMockProperty({
    id: "6",
    name: "Riverstone Condos",
    customer: "Riverstone HOA",
    address: "1 Microsoft Way",
    city: "Redmond",
    type: "Multi-Family",
    status: "Active",
    primarySystem: "LG Multi V",
    openJobs: 4,
    lastVisit: "2026-07-08",
    createdAt: "2026-02-03",
    coordinates: {
      latitude: 47.674,
      longitude: -122.1215,
    },
  }),
];