import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          {icon && (
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-b from-muted to-muted/40 text-muted-foreground ring-1 ring-border ring-inset">
              {icon}
            </div>
          )}
          <div className="space-y-1.5">
            <Badge variant="secondary" className="font-normal">
              Roadmap
            </Badge>
            <p className="max-w-sm text-sm text-muted-foreground">
              {note ?? "This section isn't built yet — it's on the roadmap."}
            </p>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
