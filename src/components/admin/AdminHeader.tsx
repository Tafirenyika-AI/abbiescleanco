"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, Bell, Plus, ChevronRight, ExternalLink, UserCircle, Settings, LogOut } from "lucide-react";
import { allNavItems, findNavItem } from "@/lib/admin/nav";
import SignOutButton from "./SignOutButton";

const quickCreateItems = [
  { label: "New Lead", href: null },
  { label: "New Quote", href: "/admin/quotes/new" },
  { label: "New Booking", href: null },
  { label: "New Customer", href: null },
  { label: "Record Payment", href: "/admin/payments" },
  { label: "Add Expense", href: null },
];

function useNotificationSummary() {
  const [total, setTotal] = useState<number | null>(null);
  const [items, setItems] = useState<{ id: string; label: string; href: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/notifications/summary")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        setTotal(json.total);
        setItems(json.items);
      })
      .catch(() => {
        if (!cancelled) setTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { total, items };
}

export default function AdminHeader({ adminName, adminRole, onOpenMenu }: { adminName: string; adminRole: string; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = findNavItem(pathname);
  const { total: notificationTotal, items: notificationItems } = useNotificationSummary();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches = query.trim()
    ? allNavItems.filter((item) => item.built && item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <header className="flex items-center gap-3 border-b border-admin-border bg-admin-card px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex size-9 items-center justify-center rounded-lg text-admin-text-muted hover:bg-admin-bg lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-xs text-admin-text-muted sm:flex">
          <span>Admin</span>
          {activeItem && (
            <>
              <ChevronRight className="size-3" aria-hidden />
              <span className="font-medium text-admin-text">{activeItem.label}</span>
            </>
          )}
        </nav>
        <h1 className="truncate text-lg font-semibold text-admin-text sm:text-xl">{activeItem?.label ?? "Admin"}</h1>
      </div>

      <div ref={searchRef} className="relative hidden sm:block">
        <div className="flex items-center gap-2 rounded-lg border border-admin-border bg-admin-bg px-3 py-2">
          <Search className="size-4 text-admin-text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search admin…"
            className="w-40 bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>
        {searchOpen && matches.length > 0 && (
          <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-admin-border bg-admin-card p-1.5 shadow-lg">
            {matches.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  router.push(item.href);
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-admin-text hover:bg-admin-bg"
              >
                <item.icon className="size-4 text-admin-text-muted" aria-hidden />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <details className="relative">
        <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-admin-text-muted hover:bg-admin-bg [&::-webkit-details-marker]:hidden">
          <span className="relative">
            <Bell className="size-5" aria-hidden />
            {!!notificationTotal && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-admin-error text-[10px] font-bold text-white">
                {notificationTotal > 9 ? "9+" : notificationTotal}
              </span>
            )}
          </span>
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-admin-border bg-admin-card p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Needs attention</p>
          {notificationItems.length === 0 ? (
            <p className="px-2 py-3 text-sm text-admin-text-muted">You&apos;re all caught up.</p>
          ) : (
            notificationItems.map((item) => (
              <Link key={item.id} href={item.href} className="block rounded-lg px-2.5 py-2 text-sm text-admin-text hover:bg-admin-bg">
                {item.label}
              </Link>
            ))
          )}
        </div>
      </details>

      <details className="relative">
        <summary className="flex list-none items-center gap-1.5 rounded-lg bg-admin-teal px-3 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover [&::-webkit-details-marker]:hidden">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Create</span>
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-xl border border-admin-border bg-admin-card p-1.5 shadow-lg">
          {quickCreateItems.map((item) =>
            item.href ? (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-admin-text hover:bg-admin-bg">
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                title="Coming soon — this module isn't built yet"
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-2 text-sm text-admin-text-muted"
              >
                {item.label}
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Soon</span>
              </span>
            )
          )}
        </div>
      </details>

      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-admin-bg [&::-webkit-details-marker]:hidden">
          <span className="flex size-8 items-center justify-center rounded-full bg-admin-teal/15 text-sm font-semibold text-admin-teal-hover">
            {adminName.charAt(0).toUpperCase()}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-admin-text">{adminName}</span>
            <span className="block text-xs text-admin-text-muted">{adminRole}</span>
          </span>
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-xl border border-admin-border bg-admin-card p-1.5 shadow-lg">
          <Link href="/admin/profile" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-admin-text hover:bg-admin-bg">
            <UserCircle className="size-4 text-admin-text-muted" aria-hidden /> My profile
          </Link>
          <Link href="/admin/settings" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-admin-text hover:bg-admin-bg">
            <Settings className="size-4 text-admin-text-muted" aria-hidden /> Business settings
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-admin-text hover:bg-admin-bg">
            <ExternalLink className="size-4 text-admin-text-muted" aria-hidden /> View public website
          </Link>
          <div className="mt-1 border-t border-admin-border pt-1">
            <SignOutButton
              renderAs={(onClick, loading) => (
                <button
                  type="button"
                  onClick={onClick}
                  disabled={loading}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-admin-error hover:bg-red-50"
                >
                  <LogOut className="size-4" aria-hidden /> {loading ? "Signing out…" : "Sign out"}
                </button>
              )}
            />
          </div>
        </div>
      </details>
    </header>
  );
}
