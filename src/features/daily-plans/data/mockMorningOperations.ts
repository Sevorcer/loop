import type {
  ChecklistItem,
  CrewProfile,
  DayOverview,
  JobPlanDetail,
} from "../types/dailyPlan";

function cloneChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item) => ({ ...item }));
}

const crewProfiles: CrewProfile[] = [
  {
    id: "crew-marcus-rivera",
    technician: "Marcus Rivera",
    leadInstaller: "Marcus Rivera",
    helper: "Elena Cruz",
    truckName: "Install Truck 4",
    truckInService: true,
    truckNote: "Condenser stand and lineset already staged.",
    certifications: ["Heat Pump", "Rigging", "Startup"],
    experienceLevel: "Senior lead · 11 years",
    availability: "available",
    dailyCapacityHours: 8,
    departureTime: "6:30 AM",
    truckChecks: [
      { label: "Fuel", ready: true },
      { label: "Ladder", ready: true },
      { label: "Vacuum pump", ready: true },
      { label: "Safety gear", ready: true },
    ],
  },
  {
    id: "crew-tina-brooks",
    technician: "Tina Brooks",
    leadInstaller: "Tina Brooks",
    helper: "Maya Singh",
    truckName: "Service Van 2",
    truckInService: true,
    truckNote: "Roof harness inspected before dispatch.",
    certifications: ["Service", "EPA Universal"],
    experienceLevel: "Lead tech · 8 years",
    availability: "available",
    dailyCapacityHours: 7.5,
    departureTime: "7:00 AM",
    truckChecks: [
      { label: "Fuel", ready: true },
      { label: "Recovery machine", ready: true },
      { label: "Battery tools", ready: true },
      { label: "Safety gear", ready: true },
    ],
  },
  {
    id: "crew-jordan-lee",
    technician: "Jordan Lee",
    leadInstaller: "Jordan Lee",
    helper: "Chris Doyle",
    truckName: "Service Truck 7",
    truckInService: true,
    truckNote: "Nitrogen refill arriving with warehouse runner at 7:20 AM.",
    certifications: ["Commercial RTU", "Controls"],
    experienceLevel: "Commercial specialist · 9 years",
    availability: "late arrival",
    dailyCapacityHours: 8,
    departureTime: "7:15 AM",
    truckChecks: [
      { label: "Fuel", ready: true },
      { label: "Nitrogen", ready: false, critical: true },
      { label: "Micron gauge", ready: true },
      { label: "Ladder", ready: true },
    ],
  },
  {
    id: "crew-riley-morgan",
    technician: "Riley Morgan",
    leadInstaller: "Riley Morgan",
    helper: "Alex Park",
    truckName: "Install Van 6",
    truckInService: true,
    truckNote: "Open capacity after morning warehouse stop.",
    certifications: ["Ductless", "Commissioning"],
    experienceLevel: "Field lead · 6 years",
    availability: "available",
    dailyCapacityHours: 8,
    departureTime: "6:45 AM",
    truckChecks: [
      { label: "Fuel", ready: true },
      { label: "Vacuum pump", ready: true },
      { label: "Battery tools", ready: true },
      { label: "Safety gear", ready: true },
    ],
  },
  {
    id: "crew-taylor-reed",
    technician: "Taylor Reed",
    leadInstaller: "Taylor Reed",
    helper: "Devon Miles",
    truckName: "Service Van 9",
    truckInService: true,
    truckNote: "Training block locked until noon.",
    certifications: ["Maintenance", "IAQ"],
    experienceLevel: "Journeyman · 5 years",
    availability: "training",
    dailyCapacityHours: 4,
    departureTime: "12:30 PM",
    truckChecks: [
      { label: "Fuel", ready: true },
      { label: "Inventory", ready: true },
      { label: "Ladder", ready: true },
      { label: "Safety gear", ready: true },
    ],
  },
  {
    id: "crew-avery-collins",
    technician: "Avery Collins",
    leadInstaller: "Avery Collins",
    helper: "Jordan Pace",
    truckName: "Quality Truck 1",
    truckInService: false,
    truckNote: "Truck assigned to inspection route is in the shop.",
    certifications: ["Quality Assurance"],
    experienceLevel: "Inspector · 7 years",
    availability: "vacation",
    dailyCapacityHours: 0,
    departureTime: "-",
    truckChecks: [
      { label: "Fuel", ready: false, critical: true },
      { label: "Inventory", ready: false, critical: true },
      { label: "Safety gear", ready: false, critical: true },
    ],
  },
];

const jobPlansById: Record<string, JobPlanDetail> = {
  "job-001": {
    city: "Seattle",
    equipment: "Carrier 10-ton rooftop package unit",
    estimatedHours: 8,
    arrivalWindow: "7:00 – 7:30 AM",
    specialNotes: "Crane permit packet must be on-site before lift begins.",
    permitRequired: true,
    photosRequired: true,
    materialsReady: true,
    readinessChecks: [
      { label: "Equipment delivered", ready: true, critical: true },
      { label: "Permit approved", ready: true, critical: true },
      { label: "Crane scheduled", ready: true, critical: true },
      { label: "Customer confirmed", ready: true },
    ],
    materialChecklist: [
      { label: "RTU curb adapter", ready: true, critical: true },
      { label: "Disconnect", ready: true },
      { label: "Controls harness", ready: true },
    ],
    constraints: [],
  },
  "job-005": {
    city: "Tacoma",
    equipment: "Copeland scroll compressor assembly",
    estimatedHours: 4.5,
    arrivalWindow: "9:00 – 10:00 AM",
    specialNotes: "Plant escort required before roof access is granted.",
    permitRequired: false,
    photosRequired: true,
    materialsReady: false,
    readinessChecks: [
      { label: "Equipment history reviewed", ready: false, critical: true },
      { label: "Customer confirmed", ready: true },
      { label: "Approval for teardown", ready: false, critical: true },
    ],
    materialChecklist: [
      { label: "Replacement contactor", ready: false, critical: true },
      { label: "Compressor oil", ready: true },
      { label: "Nitrogen", ready: false, critical: true },
    ],
    constraints: [
      { label: "Parts delayed", severity: "critical" },
      { label: "Access escort required", severity: "warning" },
    ],
  },
  "job-009": {
    city: "Seattle",
    equipment: "Mitsubishi 24k BTU ductless mini-split",
    estimatedHours: 6.5,
    arrivalWindow: "7:30 – 8:00 AM",
    specialNotes: "Mechanical room key is with gym manager at the front desk.",
    permitRequired: false,
    photosRequired: true,
    materialsReady: true,
    readinessChecks: [
      { label: "Equipment delivered", ready: true, critical: true },
      { label: "Customer confirmed", ready: true },
      { label: "Startup checklist printed", ready: true },
    ],
    materialChecklist: [
      { label: "Lineset", ready: true, critical: true },
      { label: "Wire", ready: true, critical: true },
      { label: "Pad", ready: true },
      { label: "Condensate pump", ready: true },
    ],
    constraints: [{ label: "Cardio zone access closes at 2 PM", severity: "warning" }],
  },
  "job-010": {
    city: "Renton",
    equipment: "Daikin rooftop air handler tune-up",
    estimatedHours: 3,
    arrivalWindow: "8:00 – 10:00 AM",
    specialNotes: "Roof harness required; HOA wants text updates at arrival.",
    permitRequired: false,
    photosRequired: false,
    materialsReady: true,
    readinessChecks: [
      { label: "Customer confirmed", ready: true },
      { label: "Roof access arranged", ready: true, critical: true },
      { label: "Maintenance checklist printed", ready: true },
    ],
    materialChecklist: [
      { label: "Filters", ready: true, critical: true },
      { label: "Coil cleaner", ready: true },
      { label: "Safety harness", ready: true, critical: true },
    ],
    constraints: [{ label: "HOA parking restriction", severity: "warning" }],
  },
  "job-011": {
    city: "Everett",
    equipment: "Hotel corridor fan coil maintenance set",
    estimatedHours: 2.5,
    arrivalWindow: "7:00 – 8:00 AM",
    specialNotes: "Front desk requests completion before checkout peak.",
    permitRequired: false,
    photosRequired: false,
    materialsReady: true,
    readinessChecks: [
      { label: "Customer confirmed", ready: true },
      { label: "Materials picked", ready: true, critical: true },
      { label: "Access cards loaded", ready: true },
    ],
    materialChecklist: [
      { label: "Belts", ready: true },
      { label: "Filters", ready: true, critical: true },
      { label: "Fasteners", ready: true },
    ],
    constraints: [],
  },
  "job-012": {
    city: "Bellevue",
    equipment: "East wing furnace gas valve diagnostic",
    estimatedHours: 4,
    arrivalWindow: "Before 9:00 AM",
    specialNotes: "Emergency call from resident services at 6:45 AM; elderly residents impacted.",
    permitRequired: false,
    photosRequired: true,
    materialsReady: false,
    readinessChecks: [
      { label: "Crew assigned", ready: false, critical: true },
      { label: "Customer confirmed", ready: false, critical: true },
      { label: "Equipment delivered", ready: false, critical: true },
    ],
    materialChecklist: [
      { label: "Gas valve", ready: false, critical: true },
      { label: "Thermostat", ready: false, critical: true },
      { label: "Wire", ready: true },
    ],
    constraints: [
      { label: "Customer unavailable", severity: "critical" },
      { label: "Special order part pending", severity: "critical" },
    ],
  },
  "job-013": {
    city: "Bellevue",
    equipment: "York rooftop unit B-3 diagnostic",
    estimatedHours: 5,
    arrivalWindow: "8:00 – 9:00 AM",
    specialNotes: "Warehouse runner bringing suspected contactor and capacitor kit.",
    permitRequired: false,
    photosRequired: true,
    materialsReady: false,
    readinessChecks: [
      { label: "Customer confirmed", ready: true },
      { label: "Parts staged", ready: false, critical: true },
      { label: "Roof access arranged", ready: true, critical: true },
    ],
    materialChecklist: [
      { label: "Contactor", ready: false, critical: true },
      { label: "Capacitor kit", ready: true },
      { label: "Nitrogen", ready: false, critical: true },
    ],
    constraints: [
      { label: "Parts delayed", severity: "critical" },
      { label: "Weather issue", severity: "warning" },
    ],
  },
  "job-014": {
    city: "Seattle",
    equipment: "Trane 200-ton chiller startup",
    estimatedHours: 8,
    arrivalWindow: "7:00 – 7:30 AM",
    specialNotes: "Manufacturer rep meets crew at the penthouse at 8:00 AM.",
    permitRequired: false,
    photosRequired: true,
    materialsReady: true,
    readinessChecks: [
      { label: "Manufacturer rep confirmed", ready: true, critical: true },
      { label: "Oil analysis kit staged", ready: true },
      { label: "Customer confirmed", ready: true },
    ],
    materialChecklist: [
      { label: "Oil analysis kit", ready: true, critical: true },
      { label: "Leak detector", ready: true },
      { label: "Startup paperwork", ready: true },
    ],
    constraints: [{ label: "Penthouse elevator window", severity: "warning" }],
  },
  "job-015": {
    city: "Kirkland",
    equipment: "Smart zoning controller retrofit",
    estimatedHours: 6,
    arrivalWindow: "8:30 – 9:30 AM",
    specialNotes: "Keep at least one thermostat live throughout the retrofit.",
    permitRequired: false,
    photosRequired: true,
    materialsReady: true,
    readinessChecks: [
      { label: "Customer confirmed", ready: true },
      { label: "Wiring diagrams reviewed", ready: true, critical: true },
      { label: "Replacement stats staged", ready: true },
    ],
    materialChecklist: [
      { label: "Smart thermostats", ready: true, critical: true },
      { label: "Low-voltage wire", ready: true },
      { label: "Wire labels", ready: true },
    ],
    constraints: [],
  },
};

const dayOverviewByDate: Record<string, DayOverview> = {
  "2026-07-19": {
    date: "2026-07-19",
    weatherLabel: "Hot / Dry",
    weatherDetail: "92° high · clear until late afternoon wind",
    temperatureHigh: 92,
    temperatureLow: 64,
    summary: "Morning launch is strong, but heat, parts delays, and one unassigned emergency call are pressuring the day.",
    alerts: [
      "Heat advisory after 2 PM for rooftop work.",
      "Warehouse runner is covering missing nitrogen for Jordan Lee.",
    ],
  },
  "2026-07-20": {
    date: "2026-07-20",
    weatherLabel: "Mild / Cloudy",
    weatherDetail: "76° high · marine layer through noon",
    temperatureHigh: 76,
    temperatureLow: 58,
    summary: "Balanced install day with full-day chiller startup and clean truck readiness across active crews.",
    alerts: ["Pacific Tower access window closes at 4 PM."],
  },
};

export function getCrewProfilesForDate(date: string): CrewProfile[] {
  return crewProfiles.map((crew) => {
    const nextCrew: CrewProfile = {
      ...crew,
      truckChecks: cloneChecklist(crew.truckChecks),
    };

    if (date === "2026-07-20" && crew.technician === "Taylor Reed") {
      nextCrew.availability = "half day";
      nextCrew.truckNote = "Morning training wraps at 11:30 AM before dispatch.";
    }

    return nextCrew;
  });
}

export function getDayOverview(date: string): DayOverview {
  return (
    dayOverviewByDate[date] ?? {
      date,
      weatherLabel: "Clear",
      weatherDetail: "Stable dispatch weather",
      temperatureHigh: 74,
      temperatureLow: 56,
      summary: "No major weather or fleet constraints are blocking the plan.",
      alerts: [],
    }
  );
}

export function getJobPlanDetail(jobId: string): JobPlanDetail {
  const detail = jobPlansById[jobId];

  if (!detail) {
    return {
      city: "Local market",
      equipment: "Scope confirmation pending",
      estimatedHours: 3,
      arrivalWindow: "TBD",
      permitRequired: false,
      photosRequired: false,
      materialsReady: true,
      readinessChecks: [{ label: "Scope reviewed", ready: true }],
      materialChecklist: [],
      constraints: [],
    };
  }

  return {
    ...detail,
    readinessChecks: cloneChecklist(detail.readinessChecks),
    materialChecklist: cloneChecklist(detail.materialChecklist),
    constraints: detail.constraints.map((constraint) => ({ ...constraint })),
  };
}
