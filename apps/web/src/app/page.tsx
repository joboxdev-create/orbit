import Link from "next/link";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import { auth } from "@/shared/auth";
import { getConnectors } from "@/shared/api";
import { LayerIcon } from "@/common/layer-icon";
import { BrandIcon } from "@/common/brand-icon";
import { AuthControls } from "@/common/auth-buttons";
import { Logo } from "@/common/logo";

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
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <AuthControls />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="px-2 py-16 text-center">
          <div className="mb-5 flex justify-center">
            <Logo size={84} wordmark={false} href="" />
          </div>
          <h1 className="m-0 text-4xl leading-[1.1] sm:text-5xl">
            One orbit over your
            <br />
            whole infrastructure
          </h1>
          <p className="muted mx-auto mt-4 max-w-2xl text-lg">
            ORBIT is an open source enterprise orchestrator that unifies the
            tools your company already uses — repositories, infra, identity,
            docs and more — into a single navigable graph.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Link
              href={session?.user ? "/dashboard" : "/login"}
              className="btn btn-primary"
            >
              {session?.user ? "Open dashboard" : "Get started"}
            </Link>
            <a href="https://github.com" className="btn">
              View on GitHub
            </a>
          </div>
        </section>

        <section className="pb-14">
          <div className="grid-cards">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <strong className="text-text">{f.title}</strong>
                <p className="muted mb-0 mt-1.5 text-[13px]">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-12">
          <h2 className="text-xl">Layers</h2>
          <p className="muted mt-1 text-sm">
            Interchangeable categories of enterprise services. Connectors attach
            to a project under one of these.
          </p>
          <div className="grid-cards mt-4">
            {Object.entries(LAYER_LABELS).map(([kind, label]) => (
              <div key={kind} className="card flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-muted">
                  <LayerIcon kind={kind as LayerKind} size={18} />
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-text">{label}</strong>
                  <span className="muted text-[13px]">{kind}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-4">
          <h2 className="text-xl">Supported integrations</h2>
          <p className="muted mt-1 text-sm">
            Connectors available out of the box. Configure them per project once
            you sign in.
          </p>
          {connectors.length === 0 ? (
            <div className="card mt-4">
              <p className="muted m-0 text-sm">No connectors registered yet.</p>
            </div>
          ) : (
            <div className="grid-cards mt-4">
              {connectors.map((c) => (
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

        <footer className="muted mt-16 flex justify-between border-t border-border py-6 text-[13px]">
          <span>ORBIT — open source enterprise orchestrator.</span>
          <span className="flex gap-4">
            <a href="https://github.com">GitHub</a>
            <a href="/docs">Docs</a>
          </span>
        </footer>
      </main>
    </div>
  );
}
