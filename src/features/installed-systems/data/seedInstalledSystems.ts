import type {
  InstalledSystem,
  TechnicalProfile,
} from "../types/installedSystem";

export const seedTechnicalProfiles: TechnicalProfile[] = [
  {
    id: "profile-lakeview-vrv",
    technicalIdentityId: "ti-lakeview-vrv-1",
    systemName: "Lakeview Lobby VRV System",
    manufacturer: "Daikin",
    equipmentType: "VRV Heat Pump",
    catalogEntryIds: [
      "catalog-daikin-outdoor-36",
      "catalog-daikin-air-handler-36",
    ],
    matchState: "exact",
    matchConfidence: 0.99,
    permitFields: {
      ahriNumber: "208774501",
      coolingCapacityBtu: 36000,
      heatingCapacityBtu: 38000,
      seer2: 16.4,
      eer2: 9.6,
      hspf2: 9.1,
      voltage: "208/230V-1-60",
      mca: "23.1A",
      mocp: "35A",
      refrigerant: "R-410A",
      fuelType: "Electric",
      indoorSoundDb: 39,
      outdoorSoundDb: 55,
      dimensions: '53" x 39" x 13"',
      weightLbs: 181,
    },
    knownFacts: [
      { label: "AHRI", value: "208774501" },
      { label: "Voltage", value: "208/230V-1-60" },
      { label: "MCA / MOCP", value: "23.1A / 35A" },
      { label: "Efficiency", value: "16.4 SEER2 · 9.1 HSPF2" },
    ],
    discoveredFacts: [
      { label: "Line length", value: "52 ft verified at startup" },
      { label: "Accessory", value: "Condensate safety switch installed" },
    ],
  },
];

export const seedInstalledSystems: InstalledSystem[] = [
  {
    id: "installed-lakeview-vrv-1",
    technicalIdentityId: "ti-lakeview-vrv-1",
    technicalProfileId: "profile-lakeview-vrv",
    systemName: "Lakeview Lobby VRV System",
    lifecycleStatus: "Active",
    customerName: "Lakeview Property Management",
    propertyId: "2",
    propertyName: "Lakeview Apartments",
    location: "1187 Lakeview Dr, Bellevue",
    estimateId: "EST-1842",
    jobNumber: "JOB-0988",
    matchState: "exact",
    matchConfidence: 0.99,
    installDate: "2026-03-14",
    serialNumbers: ["RXL36-LKV-2201", "FTQ36-LKV-2207"],
    accessories: ["Condensate safety switch"],
    linkedWorkflowIds: ["job-002"],
    permitReady: true,
    operationalHistory: [
      "Installed from sold replacement estimate EST-1842.",
      "Startup complete and warranty registration submitted on 2026-03-16.",
      "Service call JOB-1002 references this technical identity for current diagnostics.",
    ],
  },
];
