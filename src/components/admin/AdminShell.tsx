"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import AdminNavigation from "./AdminNavigation";
import ToastProvider from "./ui/Toast";
import type { AdminPermission } from "@/lib/permissions";

export default function AdminShell({
  adminName,
  adminRole,
  permissions,
  children,
}: {
  adminName: string;
  adminRole: string;
  permissions: AdminPermission[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="admin-workspace text-admin-text">
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to workspace</a>
        <AdminSidebar permissions={permissions} open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="admin-content">
          <AdminHeader adminName={adminName} adminRole={adminRole} onOpenMenu={() => setMobileOpen(true)} />
          <AdminNavigation permissions={permissions} />
          <main id="admin-main" className="admin-main">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
