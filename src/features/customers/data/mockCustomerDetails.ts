import type { CustomerDetails } from "../types/customerDetails";

export const mockCustomerDetails: CustomerDetails[] = [
  {
    customerId: "1",
    accountSummary: [
      "Residential customer with one active property and recurring maintenance history.",
      "Prefers text communication before arrival and same-day follow-up summaries.",
      "Recent work includes cooling maintenance and warranty airflow support.",
    ],
    properties: [
      {
        id: "1",
        name: "Smith Residence",
        address: "1428 Maple Avenue",
        city: "Seattle",
        status: "Active",
        primarySystem: "Mitsubishi Hyper Heat",
      },
    ],
    jobs: [
      {
        id: "JOB-2418",
        title: "Cooling maintenance visit",
        status: "Scheduled",
        scheduledFor: "2026-07-18",
        propertyName: "Smith Residence",
      },
      {
        id: "JOB-2284",
        title: "Warranty airflow adjustment",
        status: "Completed",
        scheduledFor: "2026-02-10",
        propertyName: "Smith Residence",
      },
    ],
    contacts: [
      {
        id: "contact-1-1",
        name: "John Smith",
        role: "Primary Contact",
        phone: "(555) 201-4408",
        email: "john.smith@example.com",
        preference: "Text before arrival",
      },
    ],
    timeline: [
      {
        id: "timeline-1-1",
        title: "Customer created in LOOP",
        date: "2025-09-12",
        description: "Customer account was created and linked to the primary property record.",
      },
      {
        id: "timeline-1-2",
        title: "Installation completed",
        date: "2025-11-18",
        description: "Primary system installation was completed and commissioned successfully.",
      },
      {
        id: "timeline-1-3",
        title: "Latest service activity",
        date: "2026-06-28",
        description: "Maintenance visit closed with technician notes and follow-up guidance.",
      },
    ],
    notes: [
      {
        id: "note-1-1",
        body: "Customer prefers a 30-minute arrival text before technicians pull in.",
      },
      {
        id: "note-1-2",
        body: "Dispatch should confirm gate/access details the morning of service.",
      },
    ],
  },
  {
    customerId: "2",
    accountSummary: [
      "Residential customer with active VRV system support and zoning follow-up history.",
      "Prefers concise service summaries after completed visits.",
      "Recent service activity includes zoning balance and refrigerant performance review.",
    ],
    properties: [
      {
        id: "2",
        name: "Johnson Residence",
        address: "88 Cedar Ridge Drive",
        city: "Bellevue",
        status: "Active",
        primarySystem: "Daikin VRV",
      },
    ],
    jobs: [
      {
        id: "JOB-2503",
        title: "System performance inspection",
        status: "Scheduled",
        scheduledFor: "2026-07-20",
        propertyName: "Johnson Residence",
      },
      {
        id: "JOB-2460",
        title: "Refrigerant balance check",
        status: "In Progress",
        scheduledFor: "2026-07-12",
        propertyName: "Johnson Residence",
      },
      {
        id: "JOB-2312",
        title: "Warranty thermostat replacement",
        status: "Completed",
        scheduledFor: "2026-03-04",
        propertyName: "Johnson Residence",
      },
    ],
    contacts: [
      {
        id: "contact-2-1",
        name: "Sarah Johnson",
        role: "Primary Contact",
        phone: "(555) 310-2281",
        email: "sarah.johnson@example.com",
        preference: "Text before arrival",
      },
    ],
    timeline: [
      {
        id: "timeline-2-1",
        title: "Customer created in LOOP",
        date: "2025-11-01",
        description: "Customer and property records were created for ongoing support.",
      },
      {
        id: "timeline-2-2",
        title: "VRV installation completed",
        date: "2025-12-05",
        description: "Primary installation passed commissioning and startup checks.",
      },
      {
        id: "timeline-2-3",
        title: "Latest service activity",
        date: "2026-07-02",
        description: "Technician documented follow-up actions for zoning balance.",
      },
    ],
    notes: [
      {
        id: "note-2-1",
        body: "Customer prefers afternoon arrival windows when possible due to morning meetings.",
      },
    ],
  },
];