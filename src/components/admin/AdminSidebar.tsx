"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Sparkles, X } from "lucide-react";
import { navGroups, findNavItem } from "@/lib/admin/nav";
import type { AdminPermission } from "@/lib/permissions";

const COLLAPSE_KEY = "admin-sidebar-collapsed";
const COLLAPSE_EVENT = "admin-sidebar-preference";
let fallbackCollapsed = true;

function readCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    return saved === null ? fallbackCollapsed : saved === "1";
  } catch { return fallbackCollapsed; }
}
function subscribeCollapsed(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(COLLAPSE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(COLLAPSE_EVENT, notify);
  };
}

export default function AdminSidebar({ permissions, open, onClose }: {
  permissions: AdminPermission[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const activeItem = findNavItem(pathname);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => true);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    sidebarRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sidebarRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open]);

  function toggleCollapsed() {
    fallbackCollapsed = !collapsed;
    try { localStorage.setItem(COLLAPSE_KEY, fallbackCollapsed ? "1" : "0"); } catch { /* Optional preference. */ }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  const groups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
  const labelClass = collapsed ? "lg:hidden" : "";

  return (
    <>
      {open && <button type="button" aria-label="Close menu backdrop" onClick={onClose} className="fixed inset-0 z-30 bg-slate-800/30 backdrop-blur-sm lg:hidden" tabIndex={-1} />}
      <aside
        ref={sidebarRef}
        id="admin-directory"
        tabIndex={-1}
        aria-label="All admin modules"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        className={`admin-sidebar fixed inset-y-0 left-0 z-40 w-[280px] shrink-0 transition-[transform,width] duration-300 lg:sticky lg:z-auto lg:visible lg:translate-x-0 ${open ? "visible translate-x-0" : "invisible -translate-x-full"} ${collapsed ? "lg:w-[76px]" : "lg:w-[270px]"}`}
      >
        <div className="flex h-full flex-col">
          <div className={`flex items-center justify-between gap-2 px-4 py-5 ${collapsed ? "lg:justify-center lg:px-3" : ""}`}>
            <Link href="/admin" aria-label="Abbie's Clean Method dashboard" className="flex items-center gap-2" onClick={onClose}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-indigo-400 text-white shadow-sm"><Sparkles className="size-4" aria-hidden /></span>
              <span className={labelClass}><span className="admin-sidebar-brand block text-sm font-semibold">Abbie&apos;s Clean Method</span><span className="block text-xs text-admin-text-muted">Admin workspace</span></span>
            </Link>
            <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-xl text-admin-text-muted lg:hidden" aria-label="Close menu"><X className="size-5" aria-hidden /></button>
          </div>
          <nav aria-label="Admin" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-admin-text-muted ${labelClass}`}>{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} onClick={onClose} aria-label={`${item.label}${item.built ? "" : " (coming soon)"}`} aria-current={activeItem?.href === item.href ? "page" : undefined}
                      title={`${item.label}${item.built ? "" : " — coming soon"}`}
                      className={`admin-sidebar-link ios-press group flex min-h-11 items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${collapsed ? "lg:justify-center" : ""}`}>
                      <span className="admin-sidebar-link-icon flex size-8 shrink-0 items-center justify-center rounded-lg"><item.icon className="size-[17px]" aria-hidden /></span>
                      <span className={`min-w-0 flex-1 ${labelClass}`}>
                        <span className="flex items-center gap-1.5"><span className="truncate">{item.label}</span>{!item.built && <span className="admin-soon">Soon</span>}</span>
                        <span className="admin-sidebar-link-description block truncate text-[11px] font-normal">{item.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-white px-3 py-3">
            <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand all modules" : "Collapse sidebar"} aria-expanded={!collapsed} className="sidebar-toggle ios-press hidden w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-medium lg:flex">
              {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <><ChevronsLeft className="size-4" aria-hidden /> Collapse</>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
