import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft, FolderGit2, Plus } from "lucide-react";
import { getOrganization, getProjects } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { EditOrgDialog } from "@/common/app-shell/edit-org-dialog";
import { DeleteOrgDialog } from "@/common/app-shell/delete-org-dialog";

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
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={14} />
          Dashboard
        </Link>
      </div>

      <PageHeader
        title={org.name}
        description={`Organization · ${org.slug}`}
        actions={
          <div className="flex items-center gap-2">
            <EditOrgDialog
              orgId={org.id}
              currentName={org.name}
              currentSlug={org.slug}
            />
            <DeleteOrgDialog orgId={org.id} orgName={org.name} />
          </div>
        }
      />

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FolderGit2 size={32} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <p className="text-xs text-muted-foreground">
              Use the{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <Plus size={11} />
              </span>{" "}
              in the sidebar to create your first project.
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
    </PageShell>
  );
}
