import { FilePlus2, FileSearch, History, LayoutDashboard, LayoutTemplate, ScrollText, Users } from "lucide-react";
import type { Role } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: Role[] };

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Work",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/quotes/new", label: "Create quote", icon: FilePlus2 },
      { href: "/quotes", label: "Search quotes", icon: FileSearch },
      { href: "/policies", label: "Policies", icon: ScrollText },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/builder", label: "UA Builder", icon: LayoutTemplate, roles: ["admin"] },
      { href: "/users", label: "Users", icon: Users, roles: ["admin"] },
      { href: "/audit", label: "Audit log", icon: History, roles: ["admin"] },
    ],
  },
];

export const ACCOUNT_ITEM = { href: "/account", label: "Account and security" };

export function isActive(href: string, pathname: string) {
  if (href === "/quotes") return pathname === "/quotes" || /^\/quotes\/\d+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNav(pathname: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => isActive(candidate.href, pathname));
    if (item) return { group: group.label, item };
  }
  if (isActive(ACCOUNT_ITEM.href, pathname)) return { group: "Account", item: ACCOUNT_ITEM };
  return null;
}
