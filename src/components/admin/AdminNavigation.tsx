"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups, findNavItem } from "@/lib/admin/nav";
import type { AdminPermission } from "@/lib/permissions";

/** The same permission-aware directory as the sidebar, presented as two compact rows. */
export default function AdminNavigation({ permissions }: { permissions: AdminPermission[] }) {
  const pathname = usePathname();
  const activeItem = findNavItem(pathname);
  const groups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
  const activeGroup = groups.find((group) => group.items.some((item) => item.href === activeItem?.href));

  return (
    <div className="admin-navigation">
      <nav aria-label="Admin sections" className="admin-group-nav">
        {groups.map((group) => (
          <Link key={group.label} href={group.items[0].href} aria-current={activeGroup?.label === group.label ? "true" : undefined}>
            {group.label === "Overview" ? "Dashboard" : group.label}
          </Link>
        ))}
      </nav>
      {activeGroup && (
        <nav aria-label={`${activeGroup.label} pages`} className="admin-page-nav">
          {activeGroup.items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={activeItem?.href === item.href ? "page" : undefined}>
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
              {!item.built && <span className="admin-soon">Soon</span>}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
