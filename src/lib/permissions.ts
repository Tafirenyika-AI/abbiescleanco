/** Client-safe permission constants/types — no server-only imports (bcrypt, Prisma). */
export const ALL_ADMIN_PERMISSIONS = [
  "MANAGE_LEADS",
  "MANAGE_PRICING",
  "MANAGE_CONTENT",
  "MANAGE_REVIEWS",
  "MANAGE_BOOKINGS",
  "MANAGE_USERS",
  "VIEW_REPORTS",
] as const;

export type AdminPermission = (typeof ALL_ADMIN_PERMISSIONS)[number];

export const permissionLabels: Record<AdminPermission, string> = {
  MANAGE_LEADS: "Manage leads",
  MANAGE_PRICING: "Manage pricing",
  MANAGE_CONTENT: "Manage content (services, FAQs, gallery, testimonials, settings)",
  MANAGE_REVIEWS: "Moderate reviews",
  MANAGE_BOOKINGS: "Manage bookings & calendar",
  MANAGE_USERS: "Manage admin users & roles",
  VIEW_REPORTS: "View reports & analytics",
};

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: AdminPermission[];
  isActive: boolean;
}
