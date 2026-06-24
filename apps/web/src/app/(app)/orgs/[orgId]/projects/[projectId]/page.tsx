import Link from "next/link";
import { notFound } from "next/navigation";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import {
  getConnectorInstances,
  getConnectors,
  getOrganization,
  getProject,
  type ConnectorInstance,
} from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { LayerIcon } from "@/common/layer-icon";
import { BrandIcon } from "@/common/brand-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EditProjectDialog } from "@/common/app-shell/edit-project-dialog";
import { DeleteProjectDialog } from "@/common/app-shell/delete-project-dialog";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const { orgId, projectId } = await params;
  const [project, instances, catalog] = await Promise.all([
    getProject(projectId),
    getConnectorInstances(projectId),
    getConnectors(),
  ]);
  if (!project) notFound();
  const org = await getOrganization(project.orgId);

  const byLayer = new Map<string, ConnectorInstance[]>();
  for (const inst of instances) {
    const list = byLayer.get(inst.layer) ?? [];
    list.push(inst);
    byLayer.set(inst.layer, list);
  }

  return (
    <PageShell>
      <PageHeader
        title={project.name}
        description={project.description ?? `Project · ${project.slug} · ${org?.name ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            <EditProjectDialog
              orgId={orgId}
              projectId={projectId}
              currentName={project.name}
              currentSlug={project.slug}
              currentDescription={project.description}
            />
            <DeleteProjectDialog
              orgId={orgId}
              projectId={projectId}
              projectName={project.name}
            />
          </div>
        }
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Layers</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(LAYER_LABELS).map(([kind, label]) => {
            const count = byLayer.get(kind)?.length ?? 0;
            return (
              <Link
                key={kind}
                href={`/orgs/${orgId}/projects/${projectId}/layers/${kind}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-accent/5"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    count > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <LayerIcon kind={kind as LayerKind} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {count === 0 ? "Not connected" : `${count} connected`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {instances.length > 0 && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Connected services
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {instances.map((inst) => (
                <Card key={inst.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <BrandIcon
                        slug={
                          catalog.find((c) => c.type === inst.connectorType)
                            ?.icon ?? null
                        }
                      />
                      <Badge variant="secondary">{inst.layer}</Badge>
                    </div>
                    <CardTitle className="text-base">{inst.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {inst.connectorType}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      <span
                        className={`size-1.5 rounded-full ${
                          inst.status === "connected"
                            ? "bg-green-500"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <span className="text-muted-foreground">
                        {inst.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
