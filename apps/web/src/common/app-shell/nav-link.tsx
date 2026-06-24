"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  const active = exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {icon && (
        <span className={active ? "text-foreground" : "text-muted-foreground"}>
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
    </Link>
  );
}
