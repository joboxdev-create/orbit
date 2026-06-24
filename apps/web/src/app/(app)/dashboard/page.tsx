import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/shared/auth";
import { getOrganizations } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreateOrgForm } from "./form";

export default async function DashboardPage() {
  const session = await auth();
  if (session!.user.platformRole !== "admin") {
    return (
      <PageShell>
        <PageHeader title="Dashboard" />
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Your account isn't a platform admin. Access for regular users is
              coming soon.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const organizations = await getOrganizations();

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Organizations you manage on this ORBIT instance."
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Organizations</h2>
        {organizations.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                No organizations yet. Create your first one below.
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
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          New organization
        </h2>
        <CreateOrgForm />
      </section>
    </PageShell>
  );
}
