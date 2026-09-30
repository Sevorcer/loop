/**
 * Zod validation schemas for the CSV Import API (Sprint 30 S30-050).
 *
 * Each entity schema validates a single CSV row after header parsing.
 * Schemas are kept in this non-server-only module so they can be imported
 * by API routes AND Vitest unit tests without triggering the server-only guard.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const nonEmptyString = (label: string) =>
  z
    .string({
      error: (issue) => (issue.input === undefined ? `${label} is required` : undefined),
    })
    .trim()
    .min(1, `${label} is required`);

// ---------------------------------------------------------------------------
// Customer row schema
// ---------------------------------------------------------------------------

export const CustomerImportRowSchema = z.object({
  name: nonEmptyString("name"),
  primaryContact: nonEmptyString("primaryContact").max(
    255,
    "primaryContact must be 255 characters or fewer"
  ),
  email: z
    .string()
    .trim()
    .email("email must be a valid email address"),
  phone: nonEmptyString("phone").max(50, "phone must be 50 characters or fewer"),
  city: nonEmptyString("city").max(100, "city must be 100 characters or fewer"),
  status: z
    .enum(["Active", "Prospect", "Inactive"], {
      message: 'status must be one of: Active, Prospect, Inactive',
    })
    .default("Active"),
});

export type CustomerImportRow = z.infer<typeof CustomerImportRowSchema>;

// ---------------------------------------------------------------------------
// Property row schema
// ---------------------------------------------------------------------------

export const PropertyImportRowSchema = z.object({
  name: nonEmptyString("name").max(255, "name must be 255 characters or fewer"),
  customer: nonEmptyString("customer").max(
    255,
    "customer must be 255 characters or fewer"
  ),
  address: nonEmptyString("address").max(
    500,
    "address must be 500 characters or fewer"
  ),
  city: nonEmptyString("city").max(100, "city must be 100 characters or fewer"),
  type: z
    .enum(["Residential", "Commercial", "Multi-Family"], {
      message: 'type must be one of: Residential, Commercial, Multi-Family',
    })
    .default("Residential"),
  status: z
    .enum(["Active", "Pending", "Inactive"], {
      message: 'status must be one of: Active, Pending, Inactive',
    })
    .default("Active"),
  primarySystem: z
    .string()
    .trim()
    .max(255, "primarySystem must be 255 characters or fewer")
    .default(""),
});

export type PropertyImportRow = z.infer<typeof PropertyImportRowSchema>;

// ---------------------------------------------------------------------------
// Job row schema
// ---------------------------------------------------------------------------

export const JobImportRowSchema = z.object({
  title: nonEmptyString("title").max(255, "title must be 255 characters or fewer"),
  type: z
    .enum(["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"], {
      message: 'type must be one of: Install, Service, Maintenance, Inspection, Estimate, Callback',
    })
    .default("Service"),
  status: z
    .enum(["Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"], {
      message: 'status must be one of: Scheduled, In Progress, On Hold, Completed, Cancelled',
    })
    .default("Scheduled"),
  priority: z
    .enum(["Low", "Medium", "High"], {
      message: 'priority must be one of: Low, Medium, High',
    })
    .default("Medium"),
  customerName: nonEmptyString("customerName").max(
    255,
    "customerName must be 255 characters or fewer"
  ),
  propertyName: nonEmptyString("propertyName").max(
    255,
    "propertyName must be 255 characters or fewer"
  ),
  assignedTo: z
    .string()
    .trim()
    .max(255, "assignedTo must be 255 characters or fewer")
    .default(""),
  scheduledFor: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledFor must be a date in YYYY-MM-DD format")
    .default(new Date().toISOString().slice(0, 10)),
  summary: z
    .string()
    .trim()
    .max(2000, "summary must be 2000 characters or fewer")
    .default(""),
  location: z
    .string()
    .trim()
    .max(500, "location must be 500 characters or fewer")
    .default(""),
  notes: z
    .string()
    .trim()
    .max(5000, "notes must be 5000 characters or fewer")
    .default(""),
});

export type JobImportRow = z.infer<typeof JobImportRowSchema>;

// ---------------------------------------------------------------------------
// Import result shape
// ---------------------------------------------------------------------------

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  mode: "dry_run" | "commit";
  entity: "customers" | "properties" | "jobs";
  total: number;
  inserted: number;
  skipped: number;
  errors: ImportRowError[];
}
