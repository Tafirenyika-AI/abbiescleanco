/** Client-safe permission constants/types — no server-only imports (bcrypt, Prisma). */
export const ALL_ADMIN_PERMISSIONS = [
  "MANAGE_LEADS",
  "MANAGE_PRICING",
  "MANAGE_CONTENT",
  "MANAGE_REVIEWS",
  "MANAGE_BOOKINGS",
  "MANAGE_USERS",
  "VIEW_REPORTS",
  "FINANCE_VIEW",
  "FINANCE_MANAGE",
  "FINANCE_EXPENSES",
  "FINANCE_PAYMENTS",
  "FINANCE_SUBCONTRACTORS",
  "FINANCE_DOCUMENTS",
  "FINANCE_TAX_RECORDS",
  "FINANCE_REFUNDS",
  "FINANCE_ADMIN",
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
  FINANCE_VIEW: "View Finance (dashboard, invoices, payments, expenses)",
  FINANCE_MANAGE: "Edit invoices & financial records",
  FINANCE_EXPENSES: "Add, edit & delete expenses",
  FINANCE_PAYMENTS: "Record & manage payments",
  FINANCE_SUBCONTRACTORS: "View & manage subcontractor payables",
  FINANCE_DOCUMENTS: "Access the financial document vault",
  FINANCE_TAX_RECORDS: "View & manage tax records",
  FINANCE_REFUNDS: "Approve refunds",
  FINANCE_ADMIN: "Manage Finance settings & permissions",
};

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: AdminPermission[];
  isActive: boolean;
  twoFactorEnabled: boolean;
}
