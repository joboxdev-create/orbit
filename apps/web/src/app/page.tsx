import Link from "next/link";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import { auth } from "@/auth";
import { getConnectors } from "@/lib/api";
import { LayerIcon } from "@/components/layer-icon";
import { BrandIcon } from "@/components/brand-icon";
import { AuthControls } from "@/components/auth-buttons";
import { Logo } from "@/components/logo";

const FEATURES = [
  {
    title: "Unified connectors",
    body: "Map every service once — its APIs and its MCP tools. Use the same definition as a direct API call or as an agent tool.",
  },
  {
    title: "One view over everything",
    body: "Organizations → Projects → Layers → Connectors. The top-down picture of your whole infrastructure, with the detail one click away.",
  },
  {
    title: "Open source, no lock-in",
    body: "Self-hostable and vendor-neutral. A solid foundation without AI first; agents come later, on top of the connectors you already mapped.",
  },
];

/** Public landing page. The real app lives behind auth at /dashboard. */
export default async function LandingPage() {
  const session = await auth();
  const connectors = await getConnectors();

  return (
    <main className="container">
      <header
        style={{
          marginBottom: 48,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Logo />
        <AuthControls />
      </header>

      <section
        style={{ textAlign: "center", margin: "32px 0 56px", padding: "0 8px" }}
      >
        <div style={{ marginBottom: 20 }}>
          <Logo size={84} wordmark={false} href="" />
        </div>
        <h1 style={{ fontSize: 44, margin: 0, lineHeight: 1.1 }}>
          One orbit over your
          <br />
          whole infrastructure
        </h1>
        <p
          className="muted"
          style={{ fontSize: 18, maxWidth: 640, margin: "16px auto 28px" }}
        >
          ORBIT is an open source enterprise orchestrator that unifies the tools
          your company already uses — repositories, infra, identity, docs and
          more — into a single navigable graph.
        </p>
        <div
          style={{ display: "flex", gap: 12, justifyContent: "center" }}
        >
          <Link
            href={session?.user ? "/dashboard" : "/login"}
            className="badge"
            style={{
              background: "var(--accent)",
              color: "#0b0e14",
              borderColor: "var(--accent)",
              fontSize: 14,
              padding: "8px 18px",
            }}
          >
            {session?.user ? "Open dashboard" : "Get started"}
          </Link>
          <a
            href="https://github.com"
            className="badge"
            style={{ fontSize: 14, padding: "8px 18px" }}
          >
            View on GitHub
          </a>
        </div>
      </section>

      <section style={{ marginBottom: 56 }}>
        <div className="grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <strong>{f.title}</strong>
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2>Layers</h2>
        <p className="muted">
          Interchangeable categories of enterprise services. Connectors attach to
          a project under one of these.
        </p>
        <div className="grid">
          {Object.entries(LAYER_LABELS).map(([kind, label]) => (
            <div key={kind} className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <LayerIcon kind={kind as LayerKind} />
                <strong>{label}</strong>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {kind}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Supported integrations</h2>
        <p className="muted">
          Connectors available out of the box. Configure them per project once
          you sign in.
        </p>
        {connectors.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              No connectors registered yet.
            </p>
          </div>
        ) : (
          <div className="grid">
            {connectors.map((c) => (
              <div key={c.type} className="card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <BrandIcon slug={c.icon} />
                  <span className="badge">{c.layer}</span>
                </div>
                <h3 style={{ margin: "10px 0 4px" }}>{c.displayName}</h3>
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

      <footer
        className="muted"
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
        }}
      >
        <span>ORBIT — open source enterprise orchestrator.</span>
        <span style={{ display: "flex", gap: 16 }}>
          <a href="https://github.com">GitHub</a>
          <a href="/docs">Docs</a>
        </span>
      </footer>
    </main>
  );
}
