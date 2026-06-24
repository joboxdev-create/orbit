import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  getConnectorInstances,
  getConnectors,
  getOrganization,
  getProjects,
  type ConnectorInstance,
} from "@/shared/api";
import { OrgSidebar } from "@/common/app-shell/org-sidebar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const [org, projects, catalog] = await Promise.all([
    getOrganization(orgId),
    getProjects(orgId),
    getConnectors(),
  ]);
  if (!org) notFound();

  // Connector instances per project, for the connector-centric sidebar. Small
  // workspaces only; revisit with a single org-scoped endpoint if it grows.
  const instancesByProject: Record<string, ConnectorInstance[]> = {};
  await Promise.all(
    projects.map(async (p) => {
      instancesByProject[p.id] = await getConnectorInstances(p.id);
    }),
  );

  return (
    <>
      <aside className="fixed bottom-0 left-0 top-14 hidden w-60 border-r border-border bg-card md:block">
        <OrgSidebar
          orgId={orgId}
          orgName={org.name}
          projects={projects}
          instancesByProject={instancesByProject}
          catalog={catalog}
        />
      </aside>
      <main className="pt-14 md:pl-60">{children}</main>
    </>
  );
}
