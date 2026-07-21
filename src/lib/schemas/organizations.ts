/**
 * Zod validation schemas for the Organizations API.
 *
 * Kept in a non-server-only module so they can be imported by both
 * server services and Vitest unit tests without triggering the
 * server-only guard.
 */

import { z } from "zod";

export const CreateOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(255, "Name must be 255 characters or fewer."),
  })
  .strict();

export const UpdateOrganizationSchema = z
  .object({
    // `name` is optional (omitting it is a no-op).  When provided it must be
    // non-empty — the API does not support clearing the organization name.
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty.")
      .max(255, "Name must be 255 characters or fewer.")
      .optional(),
  })
  .strict();

export const ListOrganizationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    includeDeleted: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  })
  .strict();

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export type ListOrganizationsQuery = z.infer<typeof ListOrganizationsQuerySchema>;
