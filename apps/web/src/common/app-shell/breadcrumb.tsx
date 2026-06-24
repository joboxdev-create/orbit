import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Trail of links above a page title. The last item is the current page. */
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="flex items-center gap-1.5 text-[13px] text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? (
            <ChevronRight size={13} className="text-muted/50" aria-hidden />
          ) : null}
          {item.href ? (
            <Link href={item.href} className="text-muted hover:text-text">
              {item.label}
            </Link>
          ) : (
            <span className="text-text">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
