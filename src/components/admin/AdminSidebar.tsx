"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Sparkles, X } from "lucide-react";
import { navGroups } from "@/lib/admin/nav";
import type { AdminPermission } from "@/lib/permissions";

const COLLAPSE_KEY = "admin-sidebar-collapsed";

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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // ignore — per-viewer convenience only
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const groups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

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
        className={`fixed inset-y-0 left-0 z-40 shrink-0 bg-admin-sidebar transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[76px]" : "w-64 lg:w-64"}`}
      >
        <div className="flex h-full flex-col">
          <div className={`flex items-center justify-between gap-2 px-5 py-5 ${collapsed ? "lg:justify-center lg:px-3" : ""}`}>
            <Link href="/admin" className="flex items-center gap-2 overflow-hidden">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-admin-teal text-white">
                <Sparkles className="size-4" aria-hidden />
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-semibold text-white">Abbie&apos;s Clean Method</span>
                  <span className="block text-[11px] text-slate-400">Admin workspace</span>
                </span>
              )}
            </Link>
            <button type="button" onClick={onClose} className="text-slate-400 lg:hidden" aria-label="Close menu">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            {groups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                )}
                <div className={`space-y-0.5 ${!collapsed ? "mt-1.5" : ""}`}>
                  {group.items.map((item) => {
                    const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    const content = (
                      <>
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            active ? "bg-white/15" : "bg-white/5 group-hover:bg-white/10"
                          }`}
                        >
                          <Icon className="size-[17px]" aria-hidden />
                        </span>
                        {!collapsed && (
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate">{item.label}</span>
                              {!item.built && (
                                <span className="shrink-0 rounded-full bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                                  Soon
                                </span>
                              )}
                            </span>
                            <span className={`block truncate text-xs font-normal ${active ? "text-white/70" : "text-slate-500"}`}>{item.description}</span>
                          </span>
                        )}
                      </>
                    );
                    const className = `group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors ${
                      collapsed ? "lg:justify-center" : ""
                    } ${
                      !item.built
                        ? "cursor-not-allowed text-slate-500"
                        : active
                          ? "bg-admin-teal text-white shadow-[0_4px_12px_rgba(15,157,138,0.35)]"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`;

                    if (!item.built) {
                      return (
                        <span key={item.href} className={className} title={`${item.label} — coming soon`} aria-disabled="true">
                          {content}
                        </span>
                      );
                    }
                    return (
                      <Link key={item.href} href={item.href} className={className} title={collapsed ? item.label : undefined}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 px-3 py-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white lg:flex"
            >
              {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
              {!collapsed && "Collapse"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
