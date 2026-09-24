import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ALL_ADMIN_PERMISSIONS } from "@/lib/permissions";
import { allNavItems } from "@/lib/admin/nav";
import AdminNavigation from "@/components/admin/AdminNavigation";
import AdminSidebar from "@/components/admin/AdminSidebar";

const current = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => current.pathname }));

describe("Admin navigation across the compact and expanded layouts", () => {
  it("keeps every existing module reachable, including planned destinations", () => {
    const html = renderToStaticMarkup(createElement(AdminSidebar, {
      permissions: [...ALL_ADMIN_PERMISSIONS], open: false, onClose: () => {},
    }));
    for (const item of allNavItems) expect(html).toContain(`href="${item.href}"`);
    expect(html).toContain("Invoices");
    expect(html).toContain("Prospecting");
    expect(html).toContain("coming soon");
  });

  it("does not expose restricted sections to an overview-only admin", () => {
    current.pathname = "/admin";
    for (const html of [
      renderToStaticMarkup(createElement(AdminNavigation, { permissions: [] })),
      renderToStaticMarkup(createElement(AdminSidebar, { permissions: [], open: true, onClose: () => {} })),
    ]) {
      expect(html).toContain('href="/admin/activity"');
      expect(html).not.toContain('href="/admin/pricing"');
      expect(html).not.toContain('href="/admin/users"');
      expect(html).not.toContain('href="/admin/reports"');
      expect(html).not.toContain('href="/admin/leads"');
    }
  });

  it("shows the complete permitted group and selects its nested detail page", () => {
    current.pathname = "/admin/invoices/invoice-123";
    const html = renderToStaticMarkup(createElement(AdminNavigation, { permissions: ["FINANCE_VIEW", "VIEW_REPORTS"] }));
    expect(html).toContain('aria-label="Finance pages"');
    const invoiceLink = html.match(/<a[^>]*href="\/admin\/invoices"[^>]*>/)?.[0];
    expect(invoiceLink).toContain('aria-current="page"');
    for (const path of ["finance", "payments", "invoices", "expenses", "reports"]) {
      expect(html).toContain(`href="/admin/${path}"`);
    }
    expect(html).not.toContain('href="/admin/quotes"');
  });
});
