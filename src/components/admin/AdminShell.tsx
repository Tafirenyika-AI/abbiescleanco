"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import SignOutButton from "./SignOutButton";
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
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar permissions={permissions} open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{adminName}</p>
              <p className="text-xs text-slate-500">{adminRole}</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              {adminName.charAt(0).toUpperCase()}
            </div>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
