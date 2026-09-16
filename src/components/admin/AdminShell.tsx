"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
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
      <div className="flex min-h-screen bg-admin-bg text-admin-text">
        <AdminSidebar permissions={permissions} open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader adminName={adminName} adminRole={adminRole} onOpenMenu={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
