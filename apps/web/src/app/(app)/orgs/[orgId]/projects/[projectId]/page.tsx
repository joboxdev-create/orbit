import { notFound } from "next/navigation";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import {
  getConnectorInstances,
  getConnectors,
  getOrganization,
  getProject,
  type ConnectorInstance,
} from "@/shared/api";
import { Breadcrumb } from "@/common/app-shell/breadcrumb";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { LayerIcon } from "@/common/layer-icon";
import { BrandIcon } from "@/common/brand-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: org?.name ?? "Organization", href: `/orgs/${orgId}` },
              { label: project.name },
            ]}
          />
        }
        title={project.name}
        description={project.description ?? `Project · ${project.slug}`}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Layers</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(LAYER_LABELS).map(([kind, label]) => {
            const count = byLayer.get(kind)?.length ?? 0;
            return (
              <div
                key={kind}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
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
              </div>
            );
          })}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Connected services
        </h2>
        {instances.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                Nothing connected yet. Connector instances are configured
                through the core API.
              </p>
            </CardContent>
          </Card>
        ) : (
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
                        inst.status === "active"
                          ? "bg-green-500"
                          : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-muted-foreground">{inst.status}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Available connectors
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((c) => (
            <Card key={c.type}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <BrandIcon slug={c.icon} />
                  <Badge variant="secondary">{c.layer}</Badge>
                </div>
                <CardTitle className="text-base">{c.displayName}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
