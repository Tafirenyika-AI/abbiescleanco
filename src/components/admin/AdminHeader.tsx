"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, Sparkles, Loader2, Bell, Plus, ChevronRight, ExternalLink, UserCircle, Settings, LogOut, CheckCheck } from "lucide-react";
import { allNavItems, findNavItem } from "@/lib/admin/nav";
import type { AdminNotificationItem } from "@/lib/server/notificationStore";
import SignOutButton from "./SignOutButton";

const quickCreateItems = [
  { label: "New Lead", href: "/admin/leads/new" },
  { label: "New Quote", href: "/admin/quotes/new" },
  { label: "New Booking", href: "/admin/bookings/new" },
  { label: "New Customer", href: "/admin/customers/new" },
  { label: "Record Payment", href: "/admin/payments" },
  { label: "Add Expense", href: "/admin/expenses" },
];

function useNotifications() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  function load() {
    fetch("/api/admin/notifications")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) return;
        setNotifications(json.notifications.slice(0, 8));
        setUnreadCount(json.unreadCount);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch("/api/admin/notifications/mark-all-read", { method: "PATCH" });
  }

  return { notifications, unreadCount, markRead, markAllRead };
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AdminHeader({ adminName, adminRole, onOpenMenu }: { adminName: string; adminRole: string; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = findNavItem(pathname);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; href?: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<{ text: string; action: Record<string, unknown> } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setSearchOpen(false); setAnswer(null); setPendingAction(null); }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches = query.trim()
    ? allNavItems.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  async function ask() {
    if (!query.trim()) return;
    setAsking(true);
    setAnswer(null);
    setPendingAction(null);
    const res = await fetch("/api/admin/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    const data = await res.json().catch(() => null);
    setAsking(false);
    if (!data?.ok) return;
    if (data.result.type === "navigate" && data.result.href) {
      router.push(data.result.href);
      setSearchOpen(false);
      setQuery("");
      return;
    }
    if (data.result.type === "confirm" && data.result.action) {
      setPendingAction({ text: data.result.text, action: data.result.action });
      return;
    }
    setAnswer({ text: data.result.text, href: data.result.href });
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setConfirming(true);
    const res = await fetch("/api/admin/assistant/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingAction.action) });
    const data = await res.json().catch(() => null);
    setConfirming(false);
    setPendingAction(null);
    if (data?.ok) {
      setAnswer({ text: data.text, href: data.href });
      setQuery("");
    } else {
      setAnswer({ text: data?.error || "Couldn't complete that." });
    }
  }

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

      <div ref={searchRef} className="relative hidden sm:block sm:w-64 lg:w-96">
        <div className="flex items-center gap-2 rounded-full border border-admin-border bg-admin-bg px-3.5 py-2.5">
          <Sparkles className="size-4 shrink-0 text-admin-teal-hover" aria-hidden />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAnswer(null); setPendingAction(null); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask Abbie Assistant or search admin…"
            className="w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
          {asking && <Loader2 className="size-4 shrink-0 animate-spin text-admin-text-muted" aria-hidden />}
        </div>
        {searchOpen && (matches.length > 0 || answer || pendingAction || query.trim()) && (
          <div className="absolute right-0 top-full z-20 mt-1.5 w-full min-w-72 rounded-xl border border-admin-border bg-admin-card p-1.5 shadow-lg">
            {pendingAction && (
              <div className="rounded-lg bg-admin-teal/5 p-2.5 text-sm text-admin-text">
                <p className="flex items-start gap-1.5"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-admin-teal-hover" aria-hidden /> {pendingAction.text}</p>
                <div className="mt-2 flex gap-1.5 pl-5">
                  <button
                    type="button"
                    onClick={confirmAction}
                    disabled={confirming}
                    className="inline-flex items-center gap-1 rounded-full bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {confirming && <Loader2 className="size-3 animate-spin" aria-hidden />} Confirm
                  </button>
                  <button type="button" onClick={() => setPendingAction(null)} className="rounded-full bg-admin-bg px-3 py-1.5 text-xs font-semibold text-admin-text">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {answer && (
              <div className="rounded-lg bg-admin-teal/5 p-2.5 text-sm text-admin-text">
                <p className="flex items-start gap-1.5"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-admin-teal-hover" aria-hidden /> {answer.text}</p>
                {answer.href && (
                  <Link href={answer.href} onClick={() => { setSearchOpen(false); setQuery(""); setAnswer(null); }} className="mt-1.5 inline-block pl-5 text-xs font-semibold text-admin-teal-hover hover:underline">
                    View details →
                  </Link>
                )}
              </div>
            )}
            {matches.length > 0 && (
              <div className={answer ? "mt-1.5 border-t border-admin-border pt-1.5" : undefined}>
                {matches.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      router.push(item.href);
                      setSearchOpen(false);
                      setQuery("");
                      setAnswer(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-admin-text hover:bg-admin-bg"
                  >
                    <item.icon className="size-4 text-admin-text-muted" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {!item.built && <span className="rounded-full bg-admin-bg px-1.5 py-0.5 text-[10px] font-semibold text-admin-text-muted">Soon</span>}
                  </button>
                ))}
              </div>
            )}
            {!answer && matches.length === 0 && query.trim() && (
              <p className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-admin-text-muted"><Search className="size-3.5" aria-hidden /> Press Enter to ask Abbie Assistant</p>
            )}
          </div>
        )}
      </div>

      <details className="relative">
        <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-admin-text-muted hover:bg-admin-bg [&::-webkit-details-marker]:hidden">
          <span className="relative">
            <Bell className="size-5" aria-hidden />
            {!!unreadCount && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-admin-error text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-xl border border-admin-border bg-admin-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-xs font-semibold text-admin-teal-hover hover:underline">
                <CheckCheck className="size-3.5" aria-hidden /> Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-2 py-3 text-sm text-admin-text-muted">You&apos;re all caught up.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "/admin/notifications"}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`block rounded-lg px-2.5 py-2 text-sm hover:bg-admin-bg ${n.isRead ? "text-admin-text-muted" : "text-admin-text"}`}
                >
                  <span className="flex items-center gap-1.5">
                    {!n.isRead && <span className="size-1.5 shrink-0 rounded-full bg-admin-teal" aria-hidden />}
                    <span className="font-medium">{n.title}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-admin-text-muted">{n.body} · {relativeTime(n.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/admin/notifications" className="mt-1 block rounded-lg px-2.5 py-2 text-center text-xs font-semibold text-admin-teal-hover hover:bg-admin-bg">
            View all
          </Link>
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
