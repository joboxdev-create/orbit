import {
  Apple,
  Github,
  HardDriveDownload,
  MonitorDown,
  Plug,
  ShieldCheck,
  Terminal,
  WifiOff,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { BrandIcon } from "@/components/brand-icon";
import { CopyCommand } from "@/components/copy-command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GITHUB_URL = "https://github.com";

const FEATURES = [
  {
    icon: WifiOff,
    title: "Local-first, offline",
    body: "Your projects live as folders on your machine and work fully offline. No account needed to get going — like git, you only sign in to sync.",
  },
  {
    icon: Plug,
    title: "Unified connectors",
    body: "Map every service once — GitHub, Docker, Jira, databases and more. The same definition powers direct API calls and AI/MCP tools.",
  },
  {
    icon: ShieldCheck,
    title: "Open source, no lock-in",
    body: "Self-hostable and vendor-neutral. A solid foundation without AI first; agents come later, on top of the connectors you already mapped.",
  },
];

// A few recognizable logos for the “works with your stack” band.
const STACK = [
  "github",
  "gitlab",
  "docker",
  "kubernetes",
  "terraform",
  "postgresql",
  "redis",
  "grafana",
  "jira",
  "slack",
  "vault",
  "anthropic",
];

const DEB_FILE = "orbit-desktop_0.1.0_amd64.deb";
const DEB_URL = `/downloads/${DEB_FILE}`;

const PLATFORMS = [
  {
    icon: HardDriveDownload,
    label: "Linux",
    note: ".deb · 64-bit · 37 MB",
    href: DEB_URL,
  },
  { icon: Apple, label: "macOS", note: "Universal", href: null },
  { icon: MonitorDown, label: "Windows", note: ".msi", href: null },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href={GITHUB_URL} className="gap-1.5">
                <Github size={15} />
                GitHub
              </a>
            </Button>
            <Button asChild size="sm">
              <a href="#download">Download</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="py-20 text-center sm:py-28">
          <Badge variant="secondary" className="mb-5">
            Local-first · Open source
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            A workspace for your projects
            <br />
            and their infrastructure
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Orbit Desktop unifies repositories, infra, tools and docs into one
            local-first workspace. It runs offline on your machine — only sync
            talks to a server.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <a href="#download" className="gap-2">
                <HardDriveDownload size={18} />
                Download for desktop
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={GITHUB_URL} className="gap-2">
                <Github size={18} />
                Star on GitHub
              </a>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon size={18} />
                </span>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Stack band */}
        <section className="pb-16 text-center">
          <p className="text-sm text-muted-foreground">
            Built to connect the tools you already use
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
            {STACK.map((slug) => (
              <span
                key={slug}
                className="opacity-70 transition-opacity hover:opacity-100"
                title={slug}
              >
                <BrandIcon slug={slug} size={30} />
              </span>
            ))}
          </div>
        </section>

        {/* Download */}
        <section
          id="download"
          className="scroll-mt-20 rounded-2xl border border-border bg-card p-8 text-center sm:p-12"
        >
          <h2 className="text-2xl font-semibold tracking-tight">
            Get Orbit Desktop
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Install once and run offline. Available for Linux now — macOS and
            Windows are on the way.
          </p>
          <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {PLATFORMS.map((p) => (
              <div
                key={p.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-5"
              >
                <p.icon size={26} className="text-muted-foreground" />
                <p className="font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.note}</p>
                {p.href ? (
                  <Button asChild size="sm" className="mt-1 gap-1.5">
                    <a href={p.href} download={DEB_FILE}>
                      <HardDriveDownload size={14} />
                      Download
                    </a>
                  </Button>
                ) : (
                  <Badge variant="secondary" className="mt-1 font-normal">
                    Coming soon
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-xl">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Terminal size={13} />
              On Debian / Ubuntu, install from the terminal:
            </p>
            <CopyCommand command={`sudo apt install ./${DEB_FILE}`} />
            <p className="mt-2 text-xs text-muted-foreground">
              Then launch <span className="font-mono">orbit</span> — or find
              “Orbit” in your apps. It runs fully offline.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-border py-8 text-xs text-muted-foreground sm:flex-row">
          <span>Orbit — open-source, local-first project workspace.</span>
          <div className="flex gap-4">
            <a href={GITHUB_URL} className="hover:text-foreground">
              GitHub
            </a>
            <a href="#download" className="hover:text-foreground">
              Download
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
