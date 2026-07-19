import type { EstimateEquipmentBundle } from "../types/installedSystem";

export const estimateEquipmentBundles: EstimateEquipmentBundle[] = [
  {
    id: "bundle-smith-main",
    estimateId: "EST-2001",
    label: "Smith Residence — Hyper-Heat Main System",
    systemName: "Main Floor Hyper-Heat Replacement",
    customerName: "John Smith",
    propertyId: "1",
    propertyName: "Smith Residence",
    location: "245 Maple Ave, Seattle",
    soldDate: "2026-07-15",
    jobTitle: "Whole-home hyper-heat replacement",
    jobSummary:
      "Replace the aging primary system with a Mitsubishi Hyper-Heat pairing and carry permit-ready technical data forward automatically.",
    jobNotes:
      "Sales confirmed panel capacity and attic access. Permit packet should inherit AHRI, electrical, and capacity values from the technical profile.",
    accessories: ["MHK2 thermostat adapter", "Surge protector"],
    equipment: [
      {
        id: "bundle-smith-main-outdoor",
        role: "Outdoor Unit",
        manufacturer: "Mitsubishi",
        modelNumber: "MXZ-SM42NAMHZ2-U1",
        equipmentType: "Heat Pump",
        serialNumber: "MXZ42-SEA-1102",
      },
      {
        id: "bundle-smith-main-air-handler",
        role: "Air Handler",
        manufacturer: "Mitsubishi",
        modelNumber: "SVZ-KP36NA",
        equipmentType: "Air Handler",
        serialNumber: "SVZ36-SEA-4421",
      },
    ],
    discoveredFacts: [
      {
        label: "Estimated line length",
        value: "38 ft",
      },
      {
        label: "Site note",
        value: "Reuse existing attic chase after pressure test.",
      },
    ],
  },
  {
    id: "bundle-johnson-ducted",
    estimateId: "EST-2002",
    label: "Johnson Residence — Ducted Replacement",
    systemName: "Second Floor Ducted Heat Pump",
    customerName: "Mike Johnson",
    propertyId: "4",
    propertyName: "Johnson Residence",
    location: "822 Cedar Ct, Bothell",
    soldDate: "2026-07-16",
    jobTitle: "Ducted heat pump replacement",
    jobSummary:
      "Convert the upstairs ducted system to a Mitsubishi hyper-heat pairing and establish a technical identity before install day.",
    jobNotes:
      "Distributor quote used an alias suffix on the outdoor unit. Technical truth should stay pending until office confirms the exact catalog match.",
    accessories: ["Branch box reuse review"],
    equipment: [
      {
        id: "bundle-johnson-ducted-outdoor",
        role: "Outdoor Unit",
        manufacturer: "Mitsubishi",
        modelNumber: "SUZ-KA36NAHZ.TH",
        equipmentType: "Heat Pump",
      },
      {
        id: "bundle-johnson-ducted-air-handler",
        role: "Air Handler",
        manufacturer: "Mitsubishi",
        modelNumber: "SVZ-KP36NA",
        equipmentType: "Air Handler",
      },
    ],
    discoveredFacts: [
      {
        label: "Existing return transition",
        value: "Needs field fabrication",
      },
    ],
  },
  {
    id: "bundle-clearwater-rooftop",
    estimateId: "EST-2003",
    label: "Clearwater Building C — Rooftop Conversion",
    systemName: "Building C Rooftop Conversion",
    customerName: "Clearwater Office Park",
    propertyName: "Clearwater Building C",
    location: "4800 Clearwater Pkwy, Building C",
    soldDate: "2026-07-17",
    jobTitle: "Packaged rooftop conversion",
    jobSummary:
      "Create the install job from the sold estimate while holding permit inheritance until the packaged rooftop model is confirmed.",
    jobNotes:
      "Sales notes reference a distributor placeholder SKU, so office should confirm the final model before permit filing.",
    accessories: ["Curb adapter", "Economizer review"],
    equipment: [
      {
        id: "bundle-clearwater-rooftop-main",
        role: "Outdoor Unit",
        manufacturer: "Carrier",
        modelNumber: "DIST-RTU-48-HP",
        equipmentType: "Packaged Rooftop",
      },
    ],
    discoveredFacts: [
      {
        label: "Roof curb condition",
        value: "Existing curb to be inspected before final order.",
      },
    ],
  },
];
