import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="space-y-8">{children}</div>
    </div>
  );
}

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
    <div className="space-y-3">
      {breadcrumb}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <Separator />
    </div>
  );
}
