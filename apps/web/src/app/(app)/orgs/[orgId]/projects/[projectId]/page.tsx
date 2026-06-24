import { notFound } from "next/navigation";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import {
  getConnectorInstances,
  getConnectors,
  getOrganization,
  getProject,
  type ConnectorInstance,
} from "@/lib/api";
import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { PageHeader, PageShell } from "@/components/app-shell/page-shell";
import { LayerIcon } from "@/components/layer-icon";
import { BrandIcon } from "@/components/brand-icon";

/**
 * Project detail: the connected services grouped by Layer, with the catalog of
 * connectors still available to attach. This is where the top-down model bottoms
 * out into concrete integrations.
 */
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

  // Group connected instances by layer for the layer-first view.
  const byLayer = new Map<string, ConnectorInstance[]>();
  for (const inst of instances) {
    const list = byLayer.get(inst.layer) ?? [];
    list.push(inst);
    byLayer.set(inst.layer, list);
  }

  return (
    <PageShell
      index={[
        { id: "layers", label: "Layers" },
        { id: "connected", label: "Connected" },
        { id: "available", label: "Available" },
      ]}
    >
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

      <section id="layers" className="scroll-mt-20">
        <h2 className="text-lg">Layers</h2>
        <p className="muted mt-1 text-sm">
          Categories of services this project can connect. The badge shows how
          many connectors are attached under each.
        </p>
        <div className="grid-cards mt-4">
          {Object.entries(LAYER_LABELS).map(([kind, label]) => {
            const count = byLayer.get(kind)?.length ?? 0;
            return (
              <div key={kind} className="card flex items-center gap-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    count > 0
                      ? "bg-accent/12 text-accent"
                      : "bg-panel-2 text-muted"
                  }`}
                >
                  <LayerIcon kind={kind as LayerKind} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {label}
                  </span>
                  <span className="muted block text-[13px]">
                    {count === 0
                      ? "Not connected"
                      : `${count} connected`}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="connected" className="scroll-mt-20">
        <h2 className="text-lg">Connected services</h2>
        {instances.length === 0 ? (
          <div className="card mt-4">
            <p className="muted m-0 text-sm">
              Nothing connected yet. Connector instances are configured through
              the core API for now (encrypted credentials per project).
            </p>
          </div>
        ) : (
          <div className="grid-cards mt-4">
            {instances.map((inst) => (
              <div key={inst.id} className="card">
                <div className="flex items-center justify-between">
                  <BrandIcon slug={catalogIcon(catalog, inst.connectorType)} />
                  <span className="badge">{inst.layer}</span>
                </div>
                <h3 className="mb-0.5 mt-2.5 text-base">{inst.name}</h3>
                <p className="muted m-0 text-[13px]">{inst.connectorType}</p>
                <span
                  className={`mt-2 inline-flex items-center gap-1.5 text-xs ${
                    inst.status === "active" ? "text-accent" : "text-muted"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {inst.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="available" className="scroll-mt-20">
        <h2 className="text-lg">Available connectors</h2>
        <p className="muted mt-1 text-sm">
          Connector types you can attach to this project.
        </p>
        <div className="grid-cards mt-4">
          {catalog.map((c) => (
            <div key={c.type} className="card">
              <div className="flex items-center justify-between">
                <BrandIcon slug={c.icon} />
                <span className="badge">{c.layer}</span>
              </div>
              <h3 className="mb-0.5 mt-2.5 text-base">{c.displayName}</h3>
              <p className="muted m-0 text-[13px]">{c.description}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

/** Best-effort brand icon for a connected instance, via the catalog entry. */
function catalogIcon(
  catalog: { type: string; icon: string | null }[],
  type: string,
): string | null {
  return catalog.find((c) => c.type === type)?.icon ?? null;
}
