import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "./page-shell";

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
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          {icon && (
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              {icon}
            </div>
          )}
          <p className="font-medium">Coming soon</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {note ?? "This section isn't built yet — it's on the roadmap."}
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
