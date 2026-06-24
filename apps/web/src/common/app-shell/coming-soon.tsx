import type { ReactNode } from "react";
import { PageHeader, PageShell } from "./page-shell";

/**
 * Consistent fallback for routes that exist in the nav but aren't built yet.
 * Keeps the shell intact so navigation never lands on a blank or 404 page.
 */
export function ComingSoon({
  title,
  description,
  icon,
  note,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  note?: string;
}) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      <div className="card flex flex-col items-center gap-3 py-14 text-center">
        {icon ? (
          <span className="flex size-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
            {icon}
          </span>
        ) : null}
        <p className="m-0 text-base font-medium text-text">Coming soon</p>
        <p className="muted m-0 max-w-md text-sm">
          {note ?? "This section isn’t built yet — it’s on the roadmap."}
        </p>
      </div>
    </PageShell>
  );
}
