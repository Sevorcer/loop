import type { Job, JobStatus } from "@/features/jobs/types/job";

import { equipmentCatalog } from "../data/equipmentCatalog";
import { estimateEquipmentBundles } from "../data/estimateEquipmentBundles";
import {
  seedInstalledSystems,
  seedTechnicalProfiles,
} from "../data/seedInstalledSystems";
import type {
  CatalogMatchResult,
  CatalogMatchState,
  EquipmentCatalogEntry,
  EstimateEquipmentBundle,
  InstalledSystem,
  InstalledSystemLifecycle,
  InstalledSystemsSnapshot,
  TechnicalProfile,
} from "../types/installedSystem";

function normalizeModelNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getLifecycleStatus(status: JobStatus): InstalledSystemLifecycle {
  if (status === "Completed") {
    return "Active";
  }

  if (status === "On Hold") {
    return "Needs Review";
  }

  return "Planned";
}

function aggregateMatchState(matches: CatalogMatchResult[]): CatalogMatchState {
  if (matches.some((match) => match.state === "unmatched")) {
    return "unmatched";
  }

  if (matches.some((match) => match.state === "possible")) {
    return "possible";
  }

  return "exact";
}

function formatCapacity(value?: number) {
  return value ? `${value.toLocaleString()} BTU` : "Pending confirmation";
}

function findCatalogMatch(
  manufacturer: string,
  modelNumber: string
): CatalogMatchResult {
  const normalizedManufacturer = manufacturer.trim().toUpperCase();
  const normalizedModelNumber = normalizeModelNumber(modelNumber);

  const catalogOptions = equipmentCatalog.filter(
    (entry) => entry.manufacturer.toUpperCase() === normalizedManufacturer
  );

  const exactMatch = catalogOptions.find((entry) => {
    const normalizedEntry = normalizeModelNumber(entry.modelNumber);
    const normalizedAliases =
      entry.matchedAliases?.map((alias) => normalizeModelNumber(alias)) ?? [];

    return (
      normalizedEntry === normalizedModelNumber ||
      normalizedAliases.includes(normalizedModelNumber)
    );
  });

  if (exactMatch) {
    return {
      state: "exact",
      confidence: 0.99,
      reason: "Exact manufacturer/model match found in the equipment catalog.",
      submittedModelNumber: modelNumber,
      matchedEntryId: exactMatch.id,
    };
  }

  const possibleMatch = catalogOptions.find((entry) => {
    const normalizedEntry = normalizeModelNumber(entry.modelNumber);

    return (
      normalizedEntry.includes(normalizedModelNumber) ||
      normalizedModelNumber.includes(normalizedEntry)
    );
  });

  if (possibleMatch) {
    return {
      state: "possible",
      confidence: 0.74,
      reason:
        "Model looks close to a known catalog entry, but office confirmation is still required.",
      submittedModelNumber: modelNumber,
      matchedEntryId: possibleMatch.id,
    };
  }

  return {
    state: "unmatched",
    confidence: 0.18,
    reason:
      "No trusted catalog entry was found, so permit-ready technical truth should not auto-populate yet.",
    submittedModelNumber: modelNumber,
  };
}

function getCatalogEntries(matchResults: CatalogMatchResult[]) {
  return matchResults
    .map((result) =>
      equipmentCatalog.find((entry) => entry.id === result.matchedEntryId)
    )
    .filter((entry): entry is EquipmentCatalogEntry => Boolean(entry));
}

function buildTechnicalProfile(
  job: Job,
  bundle: EstimateEquipmentBundle,
  technicalIdentityId: string
) {
  if (bundle.equipment.length === 0) {
    const emptyProfile: TechnicalProfile = {
      id: `profile-${job.id}`,
      technicalIdentityId,
      systemName: bundle.systemName,
      manufacturer: "Pending",
      equipmentType: "Pending",
      catalogEntryIds: [],
      matchState: "unmatched",
      matchConfidence: 0,
      permitFields: {},
      knownFacts: [
        {
          label: "Catalog match",
          value: "No equipment was attached to the sold estimate.",
        },
      ],
      discoveredFacts: [
        ...bundle.discoveredFacts,
        {
          label: "Estimate source",
          value: `${bundle.estimateId} accepted and converted into ${job.jobNumber}.`,
        },
      ],
      confirmationNote:
        "Add equipment to the sold estimate before LOOP can establish trusted technical inheritance.",
    };

    return {
      profile: emptyProfile,
      matches: [] as CatalogMatchResult[],
    };
  }

  const matches = bundle.equipment.map((equipment) =>
    findCatalogMatch(equipment.manufacturer, equipment.modelNumber)
  );
  const catalogEntries = getCatalogEntries(matches);
  const matchState = aggregateMatchState(matches);
  const matchConfidence =
    matches.reduce((total, match) => total + match.confidence, 0) / matches.length;

  const primaryEntry = catalogEntries[0];
  const outdoorEntry = catalogEntries.find((entry) => entry.role === "Outdoor Unit");
  const indoorEntry = catalogEntries.find((entry) =>
    ["Indoor Unit", "Air Handler"].includes(entry.role)
  );

  const permitFields =
    matchState === "exact"
      ? {
          ahriNumber: primaryEntry?.ahriNumber,
          coolingCapacityBtu:
            outdoorEntry?.capacity?.coolingBtu ?? indoorEntry?.capacity?.coolingBtu,
          heatingCapacityBtu:
            outdoorEntry?.capacity?.heatingBtu ?? indoorEntry?.capacity?.heatingBtu,
          seer2: primaryEntry?.efficiency?.seer2,
          eer2: primaryEntry?.efficiency?.eer2,
          hspf2: primaryEntry?.efficiency?.hspf2,
          voltage: outdoorEntry?.electrical?.voltage ?? indoorEntry?.electrical?.voltage,
          mca: outdoorEntry?.electrical?.mca,
          mocp: outdoorEntry?.electrical?.mocp,
          refrigerant: outdoorEntry?.refrigerant?.type,
          fuelType: primaryEntry?.fuelType,
          indoorSoundDb: indoorEntry?.sound?.indoorDb,
          outdoorSoundDb: outdoorEntry?.sound?.outdoorDb,
          dimensions: outdoorEntry?.physical?.dimensions,
          weightLbs: outdoorEntry?.physical?.weightLbs,
        }
      : {};

  const knownFacts =
    matchState === "exact"
      ? [
          {
            label: "AHRI",
            value: primaryEntry?.ahriNumber ?? "Pending confirmation",
          },
          {
            label: "Cooling capacity",
            value: formatCapacity(
              outdoorEntry?.capacity?.coolingBtu ?? indoorEntry?.capacity?.coolingBtu
            ),
          },
          {
            label: "Heating capacity",
            value: formatCapacity(
              outdoorEntry?.capacity?.heatingBtu ?? indoorEntry?.capacity?.heatingBtu
            ),
          },
          {
            label: "Electrical",
            value: `${outdoorEntry?.electrical?.voltage ?? "Pending"} · MCA ${
              outdoorEntry?.electrical?.mca ?? "Pending"
            } · MOCP ${outdoorEntry?.electrical?.mocp ?? "Pending"}`,
          },
          {
            label: "Refrigerant",
            value: outdoorEntry?.refrigerant?.type ?? "Pending confirmation",
          },
        ]
      : [
          {
            label: "Catalog match",
            value:
              matchState === "possible"
                ? "Possible catalog match — confirmation required"
                : "No trusted catalog match yet",
          },
        ];

  const discoveredFacts = [
    ...bundle.discoveredFacts,
    {
      label: "Estimate source",
      value: `${bundle.estimateId} accepted and converted into ${job.jobNumber}.`,
    },
  ];

  const profile: TechnicalProfile = {
    id: `profile-${job.id}`,
    technicalIdentityId,
    systemName: bundle.systemName,
    manufacturer:
      primaryEntry?.manufacturer ?? bundle.equipment[0]?.manufacturer ?? "Pending",
    equipmentType:
      primaryEntry?.equipmentType ?? bundle.equipment[0]?.equipmentType ?? "Pending",
    catalogEntryIds: catalogEntries.map((entry) => entry.id),
    matchState,
    matchConfidence,
    permitFields,
    knownFacts,
    discoveredFacts,
    confirmationNote:
      matchState === "exact"
        ? undefined
        : matches.map((match) => match.reason).join(" "),
  };

  return {
    profile,
    matches,
  };
}

function buildInstalledSystemFromJob(job: Job) {
  if (job.type !== "Install" || !job.equipmentBundleId || !job.estimateId) {
    return undefined;
  }

  const bundle = estimateEquipmentBundles.find(
    (entry) => entry.id === job.equipmentBundleId && entry.estimateId === job.estimateId
  );

  if (!bundle) {
    return undefined;
  }

  const technicalIdentityId = `ti-${job.id}`;
  const { profile, matches } = buildTechnicalProfile(job, bundle, technicalIdentityId);

  const installedSystem: InstalledSystem = {
    id: `installed-${job.id}`,
    technicalIdentityId,
    technicalProfileId: profile.id,
    systemName: bundle.systemName,
    lifecycleStatus: getLifecycleStatus(job.status),
    customerName: job.customerName,
    propertyId: bundle.propertyId,
    propertyName: job.propertyName,
    location: job.location,
    estimateId: job.estimateId,
    jobId: job.id,
    jobNumber: job.jobNumber,
    matchState: profile.matchState,
    matchConfidence: profile.matchConfidence,
    installDate: job.scheduledFor,
    serialNumbers: bundle.equipment
      .map((equipment) => equipment.serialNumber)
      .filter((value): value is string => Boolean(value)),
    accessories: bundle.accessories,
    linkedWorkflowIds: [job.id],
    permitReady: profile.matchState === "exact",
    operationalHistory: [
      `${bundle.estimateId} accepted on ${new Date(bundle.soldDate).toLocaleDateString()}.`,
      `${job.jobNumber} created and linked to permanent technical identity ${technicalIdentityId}.`,
      profile.matchState === "exact"
        ? "Permit-ready technical profile inherited automatically from trusted catalog data."
        : matches.map((match) => match.reason).join(" "),
    ],
  };

  return {
    installedSystem,
    technicalProfile: profile,
  };
}

export function getEstimateEquipmentBundle(id: string) {
  return estimateEquipmentBundles.find((bundle) => bundle.id === id);
}

export function buildInstalledSystemsSnapshot(jobs: Job[]): InstalledSystemsSnapshot {
  const derivedRecords = jobs
    .map((job) => buildInstalledSystemFromJob(job))
    .filter(
      (
        record
      ): record is {
        installedSystem: InstalledSystem;
        technicalProfile: TechnicalProfile;
      } => Boolean(record)
    );

  return {
    catalogEntries: equipmentCatalog,
    technicalProfiles: [
      ...seedTechnicalProfiles,
      ...derivedRecords.map((record) => record.technicalProfile),
    ],
    installedSystems: [
      ...seedInstalledSystems,
      ...derivedRecords.map((record) => record.installedSystem),
    ],
  };
}

export { estimateEquipmentBundles };
