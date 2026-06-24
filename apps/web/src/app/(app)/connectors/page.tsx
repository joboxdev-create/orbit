import Link from "next/link";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import { getConnectors } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { BrandIcon } from "@/common/brand-icon";

/**
 * Global catalog of connector types. Optionally filtered by ?layer=<kind> —
 * the sidebar layer entries link here. Keycloak appears as a connector (data
 * plane), not as the login system.
 */
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
    <PageShell index={[{ id: "catalog", label: "Catalog" }]}>
      <PageHeader
        title="Connectors"
        description="Connector types available out of the box. Configure them per project, with credentials encrypted at rest."
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/connectors"
          className={`badge ${layer ? "" : "border-accent text-text"}`}
        >
          All
        </Link>
        {Object.entries(LAYER_LABELS).map(([kind, label]) => (
          <Link
            key={kind}
            href={`/connectors?layer=${kind}`}
            className={`badge ${
              layer === kind ? "border-accent text-text" : ""
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <section id="catalog" className="scroll-mt-20">
        {filtered.length === 0 ? (
          <div className="card">
            <p className="muted m-0 text-sm">
              {layer
                ? `No connectors registered for ${LAYER_LABELS[layer as LayerKind] ?? layer} yet.`
                : "No connectors registered yet."}
            </p>
          </div>
        ) : (
          <div className="grid-cards">
            {filtered.map((c) => (
              <div key={c.type} className="card card-hover">
                <div className="flex items-center justify-between">
                  <BrandIcon slug={c.icon} />
                  <span className="badge">{c.layer}</span>
                </div>
                <h3 className="mb-0.5 mt-2.5 text-base">{c.displayName}</h3>
                <p className="muted m-0 text-[13px]">{c.description}</p>
                <div className="muted mt-2 text-xs">
                  {c.capabilities} capabilities · {c.apiOperations} API ops
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
