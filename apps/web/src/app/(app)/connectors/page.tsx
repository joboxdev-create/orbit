import Link from "next/link";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import { getConnectors } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { BrandIcon } from "@/common/brand-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ layer?: string }>;
}) {
  const { layer } = await searchParams;
  const connectors = await getConnectors();
  const filtered = layer
    ? connectors.filter((c) => c.layer === layer)
    : connectors;

  return (
    <PageShell>
      <PageHeader
        title="Connectors"
        description="Connector types available out of the box. Configure them per project, with credentials encrypted at rest."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/connectors">
          <Badge variant={!layer ? "default" : "outline"}>All</Badge>
        </Link>
        {Object.entries(LAYER_LABELS).map(([kind, label]) => (
          <Link key={kind} href={`/connectors?layer=${kind}`}>
            <Badge variant={layer === kind ? "default" : "outline"}>
              {label}
            </Badge>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              {layer
                ? `No connectors for ${LAYER_LABELS[layer as LayerKind] ?? layer} yet.`
                : "No connectors registered yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
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
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.capabilities} capabilities · {c.apiOperations} API ops
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
