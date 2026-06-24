import Link from "next/link";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { getOrganizations } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const organizations = await getOrganizations();

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Organizations you manage on this ORBIT instance."
      />

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Building2 size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No organizations yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Use the{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <Plus size={11} />
              </span>{" "}
              in the sidebar to create your first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Link
              key={org.id}
              href={`/orgs/${org.id}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-accent/5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{org.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {org.slug}
                </span>
              </span>
              <ArrowRight
                size={16}
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
