"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, FolderGit2, MessageSquare, Network } from "lucide-react";
import { LAYER_LABELS, LayerKind, type LayerKind as LayerKindType } from "@orbit/shared";
import { Separator } from "@/components/ui/separator";
import type { ConnectorInstance, ConnectorSummary, Project } from "@/shared/api";
import { LayerIcon } from "@/common/layer-icon";
import { BrandIcon } from "@/common/brand-icon";
import { NavLink } from "./nav-link";
import { CreateProjectDialog } from "./create-project-dialog";
import { CreateConnectorDialog } from "./create-connector-dialog";
import { ConnectorRow } from "./connector-row";

interface OrgSidebarProps {
  orgId: string;
  orgName: string;
  projects: Project[];
  instancesByProject: Record<string, ConnectorInstance[]>;
  catalog: ConnectorSummary[];
}

export function OrgSidebar({
  orgId,
  orgName,
  projects,
  instancesByProject,
  catalog,
}: OrgSidebarProps) {
  const pathname = usePathname();

  const projectMatch = pathname.match(/^\/orgs\/[^/]+\/projects\/([^/]+)/);
  const currentProjectId = projectMatch?.[1] ?? null;
  const currentProject = currentProjectId
    ? (projects.find((p) => p.id === currentProjectId) ?? null)
    : null;

  if (currentProject) {
    const base = `/orgs/${orgId}/projects/${currentProject.id}`;
    const instances = instancesByProject[currentProject.id] ?? [];

    // Group instances by layer, preserving the canonical layer order.
    const byLayer = new Map<LayerKindType, ConnectorInstance[]>();
    for (const inst of instances) {
      const list = byLayer.get(inst.layer as LayerKindType) ?? [];
      list.push(inst);
      byLayer.set(inst.layer as LayerKindType, list);
    }
    const orderedLayers = LayerKind.options.filter((k) => byLayer.has(k));

    return (
      <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
        <Link
          href={`/orgs/${orgId}`}
          className="mb-1 flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft size={13} />
          {orgName}
        </Link>

        <p className="truncate px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {currentProject.name}
        </p>

        <NavLink href={base} exact icon={<FolderGit2 size={15} />}>
          Overview
        </NavLink>
        <NavLink href={`${base}/chat`} icon={<MessageSquare size={15} />}>
          Chat
        </NavLink>
        <NavLink href={`${base}/graph`} icon={<Network size={15} />}>
          Graph
        </NavLink>

        <Separator className="my-2" />

        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Connectors
          </p>
          <CreateConnectorDialog
            orgId={orgId}
            projectId={currentProject.id}
            catalog={catalog}
          />
        </div>

        {instances.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No connectors yet.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {orderedLayers.map((layer) => {
              const layerInstances = byLayer.get(layer)!;
              const href = `${base}/layers/${layer}`;

              // Single connector in this layer: show it directly.
              if (layerInstances.length === 1) {
                const inst = layerInstances[0];
                return (
                  <ConnectorRow
                    key={inst.id}
                    orgId={orgId}
                    projectId={currentProject.id}
                    instance={inst}
                    href={href}
                    glyph={<ConnectorGlyph instance={inst} catalog={catalog} />}
                  />
                );
              }

              // Multiple connectors: group under the layer name, nested.
              return (
                <div key={layer} className="flex flex-col gap-0.5">
                  <Link
                    href={href}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <LayerIcon kind={layer} size={14} />
                    <span className="truncate">{LAYER_LABELS[layer]}</span>
                    <span className="ml-auto text-[10px] tabular-nums">
                      {layerInstances.length}
                    </span>
                  </Link>
                  <div className="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
                    {layerInstances.map((inst) => (
                      <ConnectorRow
                        key={inst.id}
                        orgId={orgId}
                        projectId={currentProject.id}
                        instance={inst}
                        href={href}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      <p className="truncate px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {orgName}
      </p>

      <Separator className="my-2" />

      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Projects
        </p>
        <CreateProjectDialog orgId={orgId} />
      </div>

      {projects.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          No projects yet.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {projects.map((project) => (
            <NavLink
              key={project.id}
              href={`/orgs/${orgId}/projects/${project.id}`}
            >
              {project.name}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

/** Brand icon when the connector is from the catalog, layer icon otherwise. */
function ConnectorGlyph({
  instance,
  catalog,
}: {
  instance: ConnectorInstance;
  catalog: ConnectorSummary[];
}) {
  const slug = catalog.find((c) => c.type === instance.connectorType)?.icon;
  if (slug) return <BrandIcon slug={slug} size={14} />;
  return <LayerIcon kind={instance.layer as LayerKindType} size={14} />;
}
