import type { ReactNode } from "react";
import { Card, CardContent } from "../ui/card";

export function ComingSoon({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        {icon && (
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-b from-muted to-muted/40 text-muted-foreground ring-1 ring-border ring-inset">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          {description && (
            <p className="max-w-sm text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
