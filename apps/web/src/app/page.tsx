import Link from "next/link";
import { LAYER_LABELS, type LayerKind } from "@orbit/shared";
import { auth } from "@/shared/auth";
import { getConnectors } from "@/shared/api";
import { LayerIcon } from "@/common/layer-icon";
import { BrandIcon } from "@/common/brand-icon";
import { AuthControls } from "@/common/auth-buttons";
import { Logo } from "@/common/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

export default async function LandingPage() {
  const session = await auth();
  const connectors = await getConnectors();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <AuthControls />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Logo size={80} wordmark={false} href="" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            One orbit over your
            <br />
            whole infrastructure
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            ORBIT is an open source enterprise orchestrator that unifies the
            tools your company already uses — repositories, infra, identity,
            docs and more — into a single navigable graph.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href={session?.user ? "/dashboard" : "/login"}>
                {session?.user ? "Open dashboard" : "Get started"}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://github.com">View on GitHub</a>
            </Button>
          </div>
        </section>

        <section className="pb-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="py-12">
          <h2 className="text-xl font-semibold tracking-tight">Layers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Interchangeable categories of enterprise services. Connectors attach
            to a project under one of these.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(LAYER_LABELS).map(([kind, label]) => (
              <div
                key={kind}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <LayerIcon kind={kind as LayerKind} size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{kind}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        <section className="py-12">
          <h2 className="text-xl font-semibold tracking-tight">
            Supported integrations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectors available out of the box. Configure them per project once
            you sign in.
          </p>
          {connectors.length === 0 ? (
            <Card className="mt-4">
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">
                  No connectors registered yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {connectors.map((c) => (
                <Card key={c.type}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <BrandIcon slug={c.icon} />
                      <Badge variant="secondary">{c.layer}</Badge>
                    </div>
                    <CardTitle className="text-base">{c.displayName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {c.description}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.capabilities} capabilities · {c.apiOperations} API ops
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between border-t border-border py-6 text-xs text-muted-foreground">
          <span>ORBIT — open source enterprise orchestrator.</span>
          <div className="flex gap-4">
            <a href="https://github.com" className="hover:text-foreground">
              GitHub
            </a>
            <a href="/docs" className="hover:text-foreground">
              Docs
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
