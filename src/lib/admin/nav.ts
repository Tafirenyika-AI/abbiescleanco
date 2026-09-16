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
  type LucideIcon,
} from "lucide-react";
import type { AdminPermission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
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
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, built: true },
      { href: "/admin/activity", label: "Activity", icon: Activity, built: false },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/leads", label: "Leads", icon: Users, permission: "MANAGE_LEADS", built: true },
      { href: "/admin/quotes", label: "Quotes", icon: FileSignature, permission: "MANAGE_LEADS", built: true },
      { href: "/admin/customers", label: "Customers", icon: UserSquare2, permission: "MANAGE_LEADS", built: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/bookings", label: "Bookings", icon: CalendarClock, permission: "MANAGE_BOOKINGS", built: true },
      { href: "/admin/calendar", label: "Calendar", icon: CalendarDays, permission: "MANAGE_BOOKINGS", built: true },
      { href: "/admin/pricing", label: "Services & pricing", icon: Wrench, permission: "MANAGE_PRICING", built: true },
      { href: "/admin/team", label: "Team", icon: UsersRound, permission: "MANAGE_USERS", built: true },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard, permission: "VIEW_REPORTS", built: true },
      { href: "/admin/expenses", label: "Expenses", icon: Receipt, permission: "VIEW_REPORTS", built: true },
      { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "VIEW_REPORTS", built: true },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/reviews", label: "Reviews", icon: Star, permission: "MANAGE_REVIEWS", built: true },
      { href: "/admin/promotions", label: "Promotions", icon: Megaphone, permission: "MANAGE_PRICING", built: false },
      { href: "/admin/automations", label: "Automations", icon: Zap, permission: "MANAGE_CONTENT", built: false },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/content", label: "Content", icon: FileText, permission: "MANAGE_CONTENT", built: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Admin users", icon: ShieldCheck, permission: "MANAGE_USERS", built: true },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "MANAGE_CONTENT", built: true },
      { href: "/admin/audit-log", label: "Audit log", icon: ScrollText, permission: "MANAGE_USERS", built: false },
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
