import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FolderGit2 } from "lucide-react";
import { getOrganization, getProjects } from "@/shared/api";
import { Breadcrumb } from "@/common/app-shell/breadcrumb";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreateProjectForm } from "./form";

export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const [org, projects] = await Promise.all([
    getOrganization(orgId),
    getProjects(orgId),
  ]);
  if (!org) notFound();

  return (
    <PageShell>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: org.name },
            ]}
          />
        }
        title={org.name}
        description={`Organization · ${org.slug}`}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                No projects yet. Create the first one below.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/orgs/${orgId}/projects/${project.id}`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-accent/5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FolderGit2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {project.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {project.slug}
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
        <h2 className="text-lg font-semibold tracking-tight">New project</h2>
        <CreateProjectForm orgId={orgId} />
      </section>
    </PageShell>
  );
}
