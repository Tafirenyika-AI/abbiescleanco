"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  FileText,
  Star,
  ShieldCheck,
  Settings,
  UserCircle,
  X,
} from "lucide-react";
import type { AdminPermission } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: AdminPermission;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users, permission: "MANAGE_LEADS" },
  { href: "/admin/pricing", label: "Pricing", icon: DollarSign, permission: "MANAGE_PRICING" },
  { href: "/admin/content", label: "Content", icon: FileText, permission: "MANAGE_CONTENT" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, permission: "MANAGE_REVIEWS" },
  { href: "/admin/users", label: "Admin users", icon: ShieldCheck, permission: "MANAGE_USERS" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "MANAGE_CONTENT" },
  { href: "/admin/profile", label: "My profile", icon: UserCircle },
];

export default function AdminSidebar({
  permissions,
  open,
  onClose,
}: {
  permissions: AdminPermission[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => !item.permission || permissions.includes(item.permission));

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-slate-800 bg-slate-900 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-lg font-semibold text-white">Abbie&apos;s Admin</span>
          <button type="button" onClick={onClose} className="text-slate-400 lg:hidden" aria-label="Close menu">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Admin" className="mt-2 space-y-1 px-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-indigo-500/15 text-indigo-300" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 px-5 py-4">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
            ← Back to public site
          </Link>
        </div>
      </aside>
    </>
  );
}
