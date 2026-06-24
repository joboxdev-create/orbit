import { notFound } from "next/navigation";
import { LAYER_LABELS, LayerKind, type LayerKind as LayerKindType } from "@orbit/shared";
import {
  getProject,
  getConnectorInstances,
  getConnectors,
  type ConnectorInstance,
} from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { LayerIcon } from "@/common/layer-icon";
import { BrandIcon } from "@/common/brand-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LayerKindPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string; kind: string }>;
}) {
  const { orgId, projectId, kind } = await params;

  // Validate the kind param against the known enum.
  const parsed = LayerKind.safeParse(kind);
  if (!parsed.success) notFound();
  const layerKind = parsed.data as LayerKindType;
  const layerLabel = LAYER_LABELS[layerKind];

  const [project, allInstances, catalog] = await Promise.all([
    getProject(projectId),
    getConnectorInstances(projectId),
    getConnectors(),
  ]);
  if (!project) notFound();

  const instances = allInstances.filter((i) => i.layer === layerKind);
  const availableConnectors = catalog.filter((c) => c.layer === layerKind);

  return (
    <PageShell>
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <LayerIcon kind={layerKind} size={22} />
            {layerLabel}
          </span>
        }
        description={`Layer · ${project.name}`}
      />

      {instances.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <LayerIcon kind={layerKind} size={28} />
            <p className="mt-3 text-sm text-muted-foreground">
              No {layerLabel.toLowerCase()} services connected yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add one with the <span className="font-medium text-foreground">+</span>{" "}
              next to “Connectors” in the sidebar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {instances.map((inst) => (
            <ConnectorInstanceCard
              key={inst.id}
              instance={inst}
              iconSlug={
                catalog.find((c) => c.type === inst.connectorType)?.icon ?? null
              }
            />
          ))}
        </div>
      )}

      {availableConnectors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Available connectors
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableConnectors.map((c) => (
              <Card key={c.type}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <BrandIcon slug={c.icon} size={24} />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{c.displayName}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.capabilities} capabilities · {c.apiOperations} API ops
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}

function ConnectorInstanceCard({
  instance,
  iconSlug,
}: {
  instance: ConnectorInstance;
  iconSlug: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <BrandIcon slug={iconSlug} size={24} />
          <Badge variant="secondary" className="text-xs">
            {instance.status}
          </Badge>
        </div>
        <CardTitle className="text-base">{instance.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{instance.connectorType}</p>
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={`size-1.5 rounded-full ${
              instance.status === "connected"
                ? "bg-green-500"
                : "bg-muted-foreground"
            }`}
          />
          <span className="text-muted-foreground">{instance.status}</span>
        </div>
      </CardContent>
    </Card>
  );
}
