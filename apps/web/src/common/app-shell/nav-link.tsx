"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Sidebar entry that highlights itself when the current route matches. `exact`
 * is for index-like links (e.g. /dashboard) that shouldn't stay active for
 * every nested path.
 */
export function NavLink({
  href,
  icon,
  children,
  exact = false,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const path = href.split("?")[0];
  // Exact for index-like links; otherwise match the segment and its children,
  // but never a longer sibling (so /connectors doesn't light up /connectors-x).
  const active = exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? "bg-accent/12 font-medium text-text"
          : "text-muted hover:bg-panel-2 hover:text-text"
      }`}
    >
      {icon ? (
        <span className={active ? "text-accent" : "text-muted"}>{icon}</span>
      ) : null}
      <span className="truncate">{children}</span>
    </Link>
  );
}
