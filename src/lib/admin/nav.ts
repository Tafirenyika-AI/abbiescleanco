import {
  LayoutDashboard,
  Activity,
  Users,
  FileSignature,
  UserSquare2,
  CalendarClock,
  CalendarDays,
  Wrench,
  UsersRound,
  CreditCard,
  Receipt,
  BarChart3,
  Star,
  Megaphone,
  Zap,
  FileText,
  ShieldCheck,
  Settings,
  ScrollText,
  Mail,
  HardHat,
  Building2,
  FileStack,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type { AdminPermission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  /** Short one-line subtitle shown under the label in the expanded sidebar. */
  description: string;
  icon: LucideIcon;
  permission?: AdminPermission;
  /** False = the destination isn't built yet; shown but disabled with a "Soon" badge. */
  built: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", description: "Business command center", icon: LayoutDashboard, built: true },
      { href: "/admin/activity", label: "Activity", description: "What's happening, live", icon: Activity, built: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/leads", label: "Leads", description: "Estimate & contact requests", icon: Users, permission: "MANAGE_LEADS", built: true },
      { href: "/admin/messages", label: "Messages", description: "Client notes & conversations", icon: Mail, permission: "MANAGE_LEADS", built: true },
      { href: "/admin/quotes", label: "Quotes", description: "Build, send, track pricing", icon: FileSignature, permission: "MANAGE_LEADS", built: true },
      { href: "/admin/customers", label: "Customers", description: "Contacts & history", icon: UserSquare2, permission: "MANAGE_LEADS", built: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/bookings", label: "Bookings", description: "Scheduled & requested jobs", icon: CalendarClock, permission: "MANAGE_BOOKINGS", built: true },
      { href: "/admin/calendar", label: "Calendar", description: "Month view of every job", icon: CalendarDays, permission: "MANAGE_BOOKINGS", built: true },
      { href: "/admin/pricing", label: "Services & pricing", description: "Rates, add-ons, service catalog", icon: Wrench, permission: "MANAGE_PRICING", built: true },
      { href: "/admin/team", label: "Team", description: "Roster & job assignments", icon: UsersRound, permission: "MANAGE_USERS", built: true },
      { href: "/admin/workforce", label: "Workforce & subcontractors", description: "Logins, documents, job offers", icon: HardHat, permission: "MANAGE_USERS", built: false },
      { href: "/admin/property-managers", label: "Property managers", description: "Multi-property turnover portal", icon: Building2, permission: "MANAGE_BOOKINGS", built: false },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments", description: "Record & reconcile payments", icon: CreditCard, permission: "VIEW_REPORTS", built: true },
      { href: "/admin/invoices", label: "Invoices", description: "Formal, printable invoices", icon: FileStack, permission: "VIEW_REPORTS", built: false },
      { href: "/admin/expenses", label: "Expenses", description: "Track business costs", icon: Receipt, permission: "VIEW_REPORTS", built: true },
      { href: "/admin/accounting", label: "Accounting", description: "Sync to QuickBooks or similar", icon: Landmark, permission: "VIEW_REPORTS", built: false },
      { href: "/admin/reports", label: "Reports", description: "Revenue, funnel, exports", icon: BarChart3, permission: "VIEW_REPORTS", built: true },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/reviews", label: "Reviews", description: "Moderate & publish reviews", icon: Star, permission: "MANAGE_REVIEWS", built: true },
      { href: "/admin/promotions", label: "Promotions", description: "Promo codes & discounts", icon: Megaphone, permission: "MANAGE_PRICING", built: true },
      { href: "/admin/automations", label: "Automations", description: "Reminders & follow-ups", icon: Zap, permission: "MANAGE_CONTENT", built: true },
      { href: "/admin/marketing", label: "Marketing studio", description: "Campaigns & social content", icon: Megaphone, permission: "MANAGE_CONTENT", built: false },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/content", label: "Content", description: "Services, FAQs, gallery", icon: FileText, permission: "MANAGE_CONTENT", built: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Admin users", description: "Admin accounts & roles", icon: ShieldCheck, permission: "MANAGE_USERS", built: true },
      { href: "/admin/settings", label: "Settings", description: "Business & integrations", icon: Settings, permission: "MANAGE_CONTENT", built: true },
      { href: "/admin/audit-log", label: "Audit log", description: "Who changed what, when", icon: ScrollText, permission: "MANAGE_USERS", built: true },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

/** Longest-matching-prefix lookup, so /admin/content/anything still resolves to "Content". */
export function findNavItem(pathname: string): NavItem | undefined {
  const candidates = allNavItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return candidates[0];
}
