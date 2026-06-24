/**
 * Right-hand "On this page" index: anchor links to the sections of the current
 * page. Pure anchors (no JS); give each target section a matching `id`.
 */
export function PageIndex({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  if (items.length === 0) return null;

  return (
    <aside className="sticky top-20 hidden h-fit w-48 shrink-0 xl:block">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
        On this page
      </p>
      <ul className="flex flex-col gap-0.5 border-l border-border">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="-ml-px block border-l border-transparent px-3 py-1 text-sm text-muted transition-colors hover:border-accent hover:text-text"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
