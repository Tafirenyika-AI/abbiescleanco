import { z } from "zod";
import { ALL_ADMIN_PERMISSIONS } from "@/lib/permissions";

export const createAdminUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8, "At least 8 characters"),
  role: z.string().trim().min(1).max(60).default("Staff"),
  permissions: z.array(z.enum(ALL_ADMIN_PERMISSIONS)).default([]),
});

export const updateAdminUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(60).optional(),
  permissions: z.array(z.enum(ALL_ADMIN_PERMISSIONS)).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional().or(z.literal("")),
});
