export type CatalogMatchState = "exact" | "possible" | "unmatched";

export type InstalledSystemLifecycle = "Planned" | "Active" | "Needs Review";

export type EquipmentRole =
  | "Outdoor Unit"
  | "Indoor Unit"
  | "Air Handler"
  | "Thermostat"
  | "Accessory";

export interface EquipmentCatalogEntry {
  id: string;
  manufacturer: string;
  modelNumber: string;
  equipmentType: string;
  role: EquipmentRole;
  series: string;
  /**
   * Alternate normalized model strings such as distributor suffix variants or
   * known SKU aliases that should still resolve to the same canonical entry.
   */
  matchedAliases?: string[];
  fuelType: string;
  ahriNumber?: string;
  efficiency?: {
    seer2?: number;
    eer2?: number;
    hspf2?: number;
  };
  capacity?: {
    coolingBtu?: number;
    heatingBtu?: number;
  };
  electrical?: {
    voltage?: string;
    mca?: string;
    mocp?: string;
  };
  refrigerant?: {
    type?: string;
    factoryChargeOz?: number;
    lineLengthAllowanceFt?: number;
  };
  sound?: {
    indoorDb?: number;
    outdoorDb?: number;
  };
  physical?: {
    weightLbs?: number;
    dimensions?: string;
  };
  documents: {
    manual: string;
    submittal: string;
  };
}

export interface EstimateEquipmentItem {
  id: string;
  role: EquipmentRole;
  manufacturer: string;
  modelNumber: string;
  equipmentType: string;
  serialNumber?: string;
}

export interface EstimateEquipmentBundle {
  id: string;
  estimateId: string;
  label: string;
  systemName: string;
  customerName: string;
  propertyId?: string;
  propertyName: string;
  location: string;
  soldDate: string;
  jobTitle: string;
  jobSummary: string;
  jobNotes: string;
  equipment: EstimateEquipmentItem[];
  accessories: string[];
  discoveredFacts: TechnicalFact[];
}

export interface CatalogMatchResult {
  state: CatalogMatchState;
  confidence: number;
  reason: string;
  submittedModelNumber: string;
  matchedEntryId?: string;
}

export interface TechnicalProfile {
  id: string;
  technicalIdentityId: string;
  systemName: string;
  manufacturer: string;
  equipmentType: string;
  catalogEntryIds: string[];
  matchState: CatalogMatchState;
  matchConfidence: number;
  permitFields: {
    ahriNumber?: string;
    coolingCapacityBtu?: number;
    heatingCapacityBtu?: number;
    seer2?: number;
    eer2?: number;
    hspf2?: number;
    voltage?: string;
    mca?: string;
    mocp?: string;
    refrigerant?: string;
    fuelType?: string;
    indoorSoundDb?: number;
    outdoorSoundDb?: number;
    dimensions?: string;
    weightLbs?: number;
  };
  knownFacts: TechnicalFact[];
  discoveredFacts: TechnicalFact[];
  confirmationNote?: string;
}

export interface TechnicalFact {
  id: string;
  label: string;
  value: string;
}

export interface InstalledSystem {
  id: string;
  technicalIdentityId: string;
  technicalProfileId: string;
  systemName: string;
  lifecycleStatus: InstalledSystemLifecycle;
  customerName: string;
  propertyId?: string;
  propertyName: string;
  location: string;
  estimateId?: string;
  jobId?: string;
  jobNumber?: string;
  matchState: CatalogMatchState;
  matchConfidence: number;
  installDate: string;
  /** Primary manufacturer name (e.g. "Mitsubishi", "Daikin"). Required. */
  manufacturer: string;
  /** Manufacturer model number (e.g. "MXZ-3C24NAHZ2"). Required. */
  modelNumber: string;
  serialNumbers: string[];
  /** ISO date string (YYYY-MM-DD) for warranty expiry, or empty string. */
  warrantyExpiry: string;
  accessories: string[];
  linkedWorkflowIds: string[];
  permitReady: boolean;
  operationalHistory: string[];
}

export interface InstalledSystemsSnapshot {
  catalogEntries: EquipmentCatalogEntry[];
  technicalProfiles: TechnicalProfile[];
  installedSystems: InstalledSystem[];
}
