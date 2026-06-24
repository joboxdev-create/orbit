import { getConnectors } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { ConnectorStore } from "@/common/connector-store";

export default async function ConnectorsPage() {
  // Real, code-backed connectors from the core registry drive the "Available"
  // badge; the rest of the catalogue is the roadmap.
  const connectors = await getConnectors();
  const availableTypes = connectors.map((c) => c.type);

  return (
    <PageShell>
      <PageHeader
        title="Connectors"
        description="Explore the connector catalogue. Available ones can be configured per project; the rest are on the roadmap."
      />
      <ConnectorStore availableTypes={availableTypes} />
    </PageShell>
  );
}
