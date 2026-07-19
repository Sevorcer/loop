import type { Job } from "../types";

function activity(id: string, title: string, description: string, createdAt: string, type: Job["activities"][number]["type"] = "created") {
  return { id, title, description, createdAt, type };
}

export const mockJobs: Job[] = [
  {
    id: "job-1001",
    title: "RTU cooling failure at lobby suite",
    customerName: "Northside Retail Group",
    propertyName: "Northside Plaza",
    assignedTo: "Marcus Rivera",
    scheduledFor: "2026-07-20",
    type: "Service",
    priority: "High",
    status: "Scheduled",
    location: "1450 Northside Blvd, Suite 100",
    summary:
      "Investigate repeated RTU lockouts and restore cooling before the weekend retail traffic ramp.",
    notes:
      "Customer can provide roof access after 8:30 AM. Bring replacement contactor and capacitor kit.",
    createdAt: "2026-07-15T15:00:00.000Z",
    updatedAt: "2026-07-18T17:30:00.000Z",
    activities: [
      activity(
        "job-1001-created",
        "Job created",
        "Service request was captured and scheduled for technician dispatch.",
        "2026-07-15T15:00:00.000Z",
        "created"
      ),
      activity(
        "job-1001-status",
        "Status changed to Scheduled",
        "Office team assigned Marcus Rivera and confirmed the first available service window.",
        "2026-07-18T17:30:00.000Z",
        "status"
      ),
    ],
  },
  {
    id: "job-1002",
    title: "Heat pump preventative maintenance",
    customerName: "Lakeview Property Management",
    propertyName: "Lakeview Apartments",
    assignedTo: "Tina Brooks",
    scheduledFor: "2026-07-22",
    type: "Maintenance",
    priority: "Medium",
    status: "In Progress",
    location: "1187 Lakeview Dr, Building B",
    summary:
      "Perform seasonal maintenance across shared corridor heat pump equipment and document any deferred repairs.",
    notes:
      "Coordinate with building manager on access to second-floor mechanical closets.",
    createdAt: "2026-07-12T18:15:00.000Z",
    updatedAt: "2026-07-18T13:45:00.000Z",
    activities: [
      activity(
        "job-1002-created",
        "Job created",
        "Maintenance visit added to the weekly schedule.",
        "2026-07-12T18:15:00.000Z",
        "created"
      ),
      activity(
        "job-1002-status",
        "Status changed to In Progress",
        "Technician checked in and started walkthrough for the first bank of equipment.",
        "2026-07-18T13:45:00.000Z",
        "status"
      ),
    ],
  },
  {
    id: "job-1003",
    title: "New office mini-split installation",
    customerName: "Evergreen Dental",
    propertyName: "Evergreen Dental",
    assignedTo: "Luis Mendoza",
    scheduledFor: "2026-07-25",
    type: "Install",
    priority: "High",
    status: "On Hold",
    location: "455 Pine St",
    summary:
      "Install a new mini-split head in the east office and complete startup after electrical coordination is finished.",
    notes:
      "Waiting on electrician to confirm breaker capacity before equipment can be set.",
    createdAt: "2026-07-10T16:00:00.000Z",
    updatedAt: "2026-07-17T19:20:00.000Z",
    activities: [
      activity(
        "job-1003-created",
        "Job created",
        "Install scope entered after site walkthrough and equipment selection.",
        "2026-07-10T16:00:00.000Z",
        "created"
      ),
      activity(
        "job-1003-status",
        "Status changed to On Hold",
        "Office paused the install until electrical coordination is complete.",
        "2026-07-17T19:20:00.000Z",
        "status"
      ),
    ],
  },
  {
    id: "job-1004",
    title: "Warehouse annual equipment inspection",
    customerName: "Westgate Holdings",
    propertyName: "Westgate Offices",
    assignedTo: "Maya Sutton",
    scheduledFor: "2026-07-16",
    type: "Inspection",
    priority: "Low",
    status: "Completed",
    location: "9200 8th Ave",
    summary:
      "Complete annual inspection paperwork for packaged rooftop equipment and update compliance records.",
    notes:
      "Inspection complete. Office to send compliance packet by end of week.",
    createdAt: "2026-07-05T14:00:00.000Z",
    updatedAt: "2026-07-16T22:10:00.000Z",
    activities: [
      activity(
        "job-1004-created",
        "Job created",
        "Compliance inspection added from annual service calendar.",
        "2026-07-05T14:00:00.000Z",
        "created"
      ),
      activity(
        "job-1004-status",
        "Status changed to Completed",
        "Technician closed out the inspection and uploaded the results for office follow-up.",
        "2026-07-16T22:10:00.000Z",
        "status"
      ),
    ],
  },
];
