import type { EquipmentCatalogEntry } from "../types/installedSystem";

export const equipmentCatalog: EquipmentCatalogEntry[] = [
  {
    id: "catalog-mitsu-outdoor-42",
    manufacturer: "Mitsubishi",
    modelNumber: "MXZ-SM42NAMHZ2-U1",
    equipmentType: "Heat Pump",
    role: "Outdoor Unit",
    series: "Hyper Heat",
    fuelType: "Electric",
    ahriNumber: "214908321",
    efficiency: {
      seer2: 17.2,
      eer2: 10.1,
      hspf2: 9.8,
    },
    capacity: {
      coolingBtu: 42000,
      heatingBtu: 48000,
    },
    electrical: {
      voltage: "208/230V-1-60",
      mca: "28.0A",
      mocp: "40A",
    },
    refrigerant: {
      type: "R-410A",
      factoryChargeOz: 181,
      lineLengthAllowanceFt: 98,
    },
    sound: {
      outdoorDb: 58,
    },
    physical: {
      weightLbs: 194,
      dimensions: '52" x 41" x 13"',
    },
    documents: {
      manual: "Mitsubishi MXZ-SM42 installation manual",
      submittal: "Mitsubishi MXZ-SM42 submittal",
    },
  },
  {
    id: "catalog-mitsu-air-handler-36",
    manufacturer: "Mitsubishi",
    modelNumber: "SVZ-KP36NA",
    equipmentType: "Air Handler",
    role: "Air Handler",
    series: "SUZ/SVZ Ducted",
    fuelType: "Electric",
    ahriNumber: "214908321",
    efficiency: {
      seer2: 17.2,
      eer2: 10.1,
      hspf2: 9.8,
    },
    capacity: {
      coolingBtu: 36000,
      heatingBtu: 40000,
    },
    electrical: {
      voltage: "208/230V-1-60",
      mca: "6.2A",
      mocp: "15A",
    },
    refrigerant: {
      type: "R-410A",
      lineLengthAllowanceFt: 98,
    },
    sound: {
      indoorDb: 35,
    },
    physical: {
      weightLbs: 108,
      dimensions: '21" x 51" x 48"',
    },
    documents: {
      manual: "Mitsubishi SVZ-KP36 installation manual",
      submittal: "Mitsubishi SVZ-KP36 submittal",
    },
  },
  {
    id: "catalog-daikin-outdoor-36",
    manufacturer: "Daikin",
    modelNumber: "RXL36WMVJU9",
    equipmentType: "Heat Pump",
    role: "Outdoor Unit",
    series: "SkyAir",
    fuelType: "Electric",
    ahriNumber: "208774501",
    efficiency: {
      seer2: 16.4,
      eer2: 9.6,
      hspf2: 9.1,
    },
    capacity: {
      coolingBtu: 36000,
      heatingBtu: 38000,
    },
    electrical: {
      voltage: "208/230V-1-60",
      mca: "23.1A",
      mocp: "35A",
    },
    refrigerant: {
      type: "R-410A",
      factoryChargeOz: 151,
      lineLengthAllowanceFt: 98,
    },
    sound: {
      outdoorDb: 55,
    },
    physical: {
      weightLbs: 181,
      dimensions: '53" x 39" x 13"',
    },
    documents: {
      manual: "Daikin RXL36WMVJU9 installation manual",
      submittal: "Daikin RXL36WMVJU9 submittal",
    },
  },
  {
    id: "catalog-daikin-air-handler-36",
    manufacturer: "Daikin",
    modelNumber: "FTQ36TAVJUD",
    equipmentType: "Air Handler",
    role: "Air Handler",
    series: "SkyAir",
    fuelType: "Electric",
    ahriNumber: "208774501",
    efficiency: {
      seer2: 16.4,
      eer2: 9.6,
      hspf2: 9.1,
    },
    capacity: {
      coolingBtu: 36000,
      heatingBtu: 38000,
    },
    electrical: {
      voltage: "208/230V-1-60",
      mca: "7.4A",
      mocp: "15A",
    },
    refrigerant: {
      type: "R-410A",
      lineLengthAllowanceFt: 98,
    },
    sound: {
      indoorDb: 39,
    },
    physical: {
      weightLbs: 116,
      dimensions: '22" x 54" x 49"',
    },
    documents: {
      manual: "Daikin FTQ36TAVJUD installation manual",
      submittal: "Daikin FTQ36TAVJUD submittal",
    },
  },
  {
    id: "catalog-mitsu-outdoor-36",
    manufacturer: "Mitsubishi",
    modelNumber: "SUZ-KA36NAHZ2",
    equipmentType: "Heat Pump",
    role: "Outdoor Unit",
    series: "Hyper Heat",
    // Use aliases only for trusted manufacturer-equivalent variants such as
    // distributor suffixes or alternate SKU formatting that map to the same unit.
    matchedAliases: ["SUZ-KA36NAHZ.TH"],
    fuelType: "Electric",
    ahriNumber: "216550441",
    efficiency: {
      seer2: 16.0,
      eer2: 9.2,
      hspf2: 9.0,
    },
    capacity: {
      coolingBtu: 36000,
      heatingBtu: 40000,
    },
    electrical: {
      voltage: "208/230V-1-60",
      mca: "25.0A",
      mocp: "40A",
    },
    refrigerant: {
      type: "R-410A",
      factoryChargeOz: 176,
      lineLengthAllowanceFt: 98,
    },
    sound: {
      outdoorDb: 56,
    },
    physical: {
      weightLbs: 187,
      dimensions: '52" x 41" x 13"',
    },
    documents: {
      manual: "Mitsubishi SUZ-KA36 installation manual",
      submittal: "Mitsubishi SUZ-KA36 submittal",
    },
  },
];
