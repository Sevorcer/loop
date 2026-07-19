import type { PropertyDetails } from "../types/propertyDetails";

export const mockPropertyDetails: PropertyDetails[] = [
  {
    propertyId: "1",
    beforeYouGoItems: [
      "Confirm property access and parking before arrival.",
      "Review latest visit notes and open job context.",
      "Verify Mitsubishi equipment match before starting work.",
    ],
    homeIntelligenceItems: [
      "Outdoor equipment located on the west side of the property.",
      "Preferred customer contact is text message before arrival.",
      "16x25x1 filter size noted for future service preparation.",
    ],
    equipment: [
      {
        id: "eq-1-1",
        name: "Mitsubishi Hyper Heat",
        kind: "Primary system",
        status: "Operational",
        serial: "SN-HVAC-20481",
        installDate: "2025-11-18",
      },
      {
        id: "eq-1-2",
        name: "Smart Thermostat",
        kind: "Controls",
        status: "Online",
        serial: "SN-CTRL-88214",
        installDate: "2025-11-18",
      },
    ],
    jobs: [
      {
        id: "JOB-2418",
        title: "Cooling maintenance visit",
        status: "Scheduled",
        scheduledFor: "2026-07-18",
        crew: "Crew 2",
      },
      {
        id: "JOB-2284",
        title: "Warranty airflow adjustment",
        status: "Completed",
        scheduledFor: "2026-02-10",
        crew: "Service Tech 4",
      },
    ],
    timeline: [
      {
        id: "tl-1-1",
        title: "Property created in LOOP",
        date: "2025-09-12",
        description: "Property profile added and made available for scheduling.",
        icon: "property",
      },
      {
        id: "tl-1-2",
        title: "Initial installation commissioned",
        date: "2025-11-18",
        description: "Primary system installed and startup completed successfully.",
        icon: "install",
      },
      {
        id: "tl-1-3",
        title: "Last service visit completed",
        date: "2026-06-28",
        description: "Maintenance visit closed with technician notes recorded.",
        icon: "service",
      },
    ],
    contacts: [
      {
        id: "contact-1-1",
        name: "John Smith",
        role: "Primary Customer",
        phone: "(555) 201-4408",
        preference: "Text before arrival",
      },
      {
        id: "contact-1-2",
        name: "Site Access Contact",
        role: "Secondary Contact",
        phone: "(555) 201-4412",
        preference: "Call on arrival",
      },
    ],
    warranty: [
      {
        id: "w-1-1",
        title: "Equipment",
        description: "Registered manufacturer coverage through 11/18/2035.",
      },
      {
        id: "w-1-2",
        title: "Labor",
        description: "Contractor labor warranty active through 11/18/2027.",
      },
      {
        id: "w-1-3",
        title: "Registration",
        description: "Registration submitted and stored for future claim support.",
      },
    ],
    notes: [
      "Access gate code is stored with dispatch and should be confirmed on the morning of service.",
      "Homeowner prefers communication by text and requests 30-minute arrival notice before technicians pull in.",
    ],
    documents: [
      {
        id: "doc-1-1",
        title: "Warranty Registration",
        category: "Warranty",
        uploadedAt: "2025-11-19",
        status: "Ready",
      },
      {
        id: "doc-1-2",
        title: "Startup Checklist",
        category: "Commissioning",
        uploadedAt: "2025-11-18",
        status: "Ready",
      },
    ],
    photos: [
      {
        id: "photo-1-1",
        title: "Outdoor Unit - Final Install",
        category: "Completion",
        capturedAt: "2025-11-18",
        status: "Complete",
      },
      {
        id: "photo-1-2",
        title: "Lineset Routing",
        category: "Install Progress",
        capturedAt: "2025-11-18",
        status: "Complete",
      },
      {
        id: "photo-1-3",
        title: "Electrical Disconnect",
        category: "QC",
        capturedAt: "2025-11-18",
        status: "Flagged",
      },
    ],
  },
  {
    propertyId: "2",
    beforeYouGoItems: [
      "Coordinate arrival window with homeowner before dispatch.",
      "Review open jobs and current VRV performance notes.",
      "Verify thermostat and zoning history before service begins.",
    ],
    homeIntelligenceItems: [
      "Primary system serves both upper and lower living zones.",
      "Customer prefers same-day summary after any completed visit.",
      "Driveway access is easiest from the east side of the property.",
    ],
    equipment: [
      {
        id: "eq-2-1",
        name: "Daikin VRV",
        kind: "Primary system",
        status: "Operational",
        serial: "SN-VRV-44128",
        installDate: "2025-12-05",
      },
      {
        id: "eq-2-2",
        name: "Zone Controller",
        kind: "Controls",
        status: "Online",
        serial: "SN-ZONE-11102",
        installDate: "2025-12-05",
      },
    ],
    jobs: [
      {
        id: "JOB-2503",
        title: "System performance inspection",
        status: "Scheduled",
        scheduledFor: "2026-07-20",
        crew: "Crew 1",
      },
      {
        id: "JOB-2460",
        title: "Refrigerant balance check",
        status: "In Progress",
        scheduledFor: "2026-07-12",
        crew: "Service Tech 2",
      },
      {
        id: "JOB-2312",
        title: "Warranty thermostat replacement",
        status: "Completed",
        scheduledFor: "2026-03-04",
        crew: "Service Tech 1",
      },
    ],
    timeline: [
      {
        id: "tl-2-1",
        title: "Property created in LOOP",
        date: "2025-11-01",
        description: "Customer and property records were created for ongoing support.",
        icon: "property",
      },
      {
        id: "tl-2-2",
        title: "VRV installation completed",
        date: "2025-12-05",
        description: "Daikin system startup passed commissioning checks.",
        icon: "install",
      },
      {
        id: "tl-2-3",
        title: "Latest service visit completed",
        date: "2026-07-02",
        description: "Technician documented follow-up actions for zoning balance.",
        icon: "service",
      },
    ],
    contacts: [
      {
        id: "contact-2-1",
        name: "Sarah Johnson",
        role: "Primary Customer",
        phone: "(555) 310-2281",
        preference: "Text before arrival",
      },
    ],
    warranty: [
      {
        id: "w-2-1",
        title: "Equipment",
        description: "Manufacturer coverage active through 12/05/2035.",
      },
      {
        id: "w-2-2",
        title: "Labor",
        description: "Labor coverage active through 12/05/2028.",
      },
      {
        id: "w-2-3",
        title: "Registration",
        description: "Warranty registration completed and verified.",
      },
    ],
    notes: [
      "Customer is sensitive to noise during morning meetings and prefers afternoon arrival windows when possible.",
    ],
    documents: [
      {
        id: "doc-2-1",
        title: "Permit Packet",
        category: "Permits",
        uploadedAt: "2025-12-02",
        status: "Ready",
      },
      {
        id: "doc-2-2",
        title: "Thermostat Warranty Claim",
        category: "Warranty",
        uploadedAt: "2026-03-05",
        status: "Pending Review",
      },
    ],
    photos: [
      {
        id: "photo-2-1",
        title: "Indoor Unit Install",
        category: "Completion",
        capturedAt: "2025-12-05",
        status: "Complete",
      },
      {
        id: "photo-2-2",
        title: "Drain Line Routing",
        category: "QC",
        capturedAt: "2025-12-05",
        status: "Complete",
      },
    ],
  },
];