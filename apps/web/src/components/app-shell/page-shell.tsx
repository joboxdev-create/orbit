import type { ReactNode } from "react";
import { PageIndex } from "./page-index";

/**
 * Standard authenticated-page frame: a centered content column with an optional
 * sticky right index. Sections inside should carry `id`s matching `index`.
 */
export function PageShell({
  children,
  index,
}: {
  children: ReactNode;
  index?: { id: string; label: string }[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-10 px-6 py-8">
      <div className="min-w-0 flex-1 space-y-10">{children}</div>
      {index ? <PageIndex items={index} /> : null}
    </div>
  );
}

/** Page title block with optional breadcrumb and right-aligned actions. */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div>
      {breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl">{title}</h1>
          {description ? (
            <p className="muted mt-1.5 max-w-2xl text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
