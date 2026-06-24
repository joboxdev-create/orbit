import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getConnectors, getProject } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { ConnectorStore } from "@/common/connector-store";

export default async function ProjectConnectorsPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const { orgId, projectId } = await params;
  const [project, connectors] = await Promise.all([
    getProject(projectId),
    getConnectors(),
  ]);
  if (!project) notFound();
  const availableTypes = connectors.map((c) => c.type);
  const base = `/orgs/${orgId}/projects/${projectId}`;

  return (
    <PageShell>
      <div>
        <Link
          href={base}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={14} />
          {project.name}
        </Link>
      </div>

      <PageHeader
        title="Connectors"
        description="Explore the connector catalogue. Available ones can be added to this project; the rest are on the roadmap."
      />

      <ConnectorStore availableTypes={availableTypes} />
    </PageShell>
  );
}
