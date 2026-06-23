import { LAYER_LABELS } from "@orbit/shared";
import { getConnectors } from "@/lib/api";

export default async function HomePage() {
  const connectors = await getConnectors();

  return (
    <main className="container">
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0 }}>ORBIT</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Open source enterprise orchestrator — one view over your whole
          infrastructure.
        </p>
      </header>

      <section style={{ marginBottom: 40 }}>
        <h2>Layers</h2>
        <p className="muted">
          Interchangeable categories of enterprise services. Connectors attach
          to a project under one of these.
        </p>
        <div className="grid">
          {Object.entries(LAYER_LABELS).map(([kind, label]) => (
            <div key={kind} className="card">
              <strong>{label}</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {kind}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Connectors</h2>
        {connectors.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              No connectors registered yet. The core is reachable once it runs;
              the first <code>@orbit/connector-*</code> package will appear here.
            </p>
          </div>
        ) : (
          <div className="grid">
            {connectors.map((c) => (
              <div key={c.type} className="card">
                <span className="badge">{c.layer}</span>
                <h3 style={{ margin: "8px 0 4px" }}>{c.displayName}</h3>
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  {c.description}
                </p>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {c.capabilities} capabilities · {c.apiOperations} API ops
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
