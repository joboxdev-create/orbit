import { useEffect, useState } from "react";
import { ArrowRight, FolderGit2, Network, Plug } from "lucide-react";
import { LAYER_LABELS } from "@orbit/shared";
import {
  api,
  type CatalogEntry,
  type ConnectorInstance,
  type Conversation,
  type Project,
} from "./lib/api";
import { Navbar } from "./components/app-shell/navbar";
import { Sidebar, type ProjectView } from "./components/app-shell/sidebar";
import { ComingSoon } from "./components/app-shell/coming-soon";
import { ProjectActions } from "./components/app-shell/project-actions";
import { ConnectorDetail } from "./components/connector-detail";
import { Chat } from "./components/chat";
import { BrandIcon } from "./components/ui/brand-icon";
import { Card, CardContent } from "./components/ui/card";

function workspaceName(path: string | null): string {
  if (!path) return "Workspace";
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "Workspace";
}

function layerLabel(layer: string): string {
  return LAYER_LABELS[layer as keyof typeof LAYER_LABELS] ?? layer;
}

export default function App() {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Project | null>(null);
  const [view, setView] = useState<ProjectView>({ kind: "overview" });
  const [connectors, setConnectors] = useState<ConnectorInstance[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);

  async function refresh() {
    setError(null);
    try {
      const [h, ps] = await Promise.all([api.health(), api.listProjects()]);
      setWorkspace(h.workspace);
      setProjects(ps);
      setSelected((cur) =>
        cur ? (ps.find((p) => p.id === cur.id) ?? null) : null,
      );
    } catch (e) {
      setError(
        `${(e as Error).message} — sidecar non raggiungibile (riavvia l'app)`,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    void api.catalog().then(setCatalog).catch(() => {});
  }, []);

  async function loadConnectors(projectId: string) {
    try {
      setConnectors(await api.listConnectors(projectId));
    } catch {
      setConnectors([]);
    }
  }

  async function loadConversations(projectId: string) {
    try {
      setConversations(await api.listConversations(projectId));
    } catch {
      setConversations([]);
    }
  }

  function openProject(p: Project) {
    setSelected(p);
    setView({ kind: "overview" });
    void loadConnectors(p.id);
    void loadConversations(p.id);
  }

  async function onConnectorsChanged() {
    if (!selected) return;
    const cs = await api.listConnectors(selected.id);
    setConnectors(cs);
    setView((v) =>
      v.kind === "connector" && !cs.find((c) => c.id === v.id)
        ? { kind: "overview" }
        : v,
    );
  }

  async function onConversationsChanged() {
    if (!selected) return;
    const cs = await api.listConversations(selected.id);
    setConversations(cs);
    setView((v) =>
      v.kind === "chat" &&
      v.conversationId &&
      !cs.find((c) => c.id === v.conversationId)
        ? { kind: "overview" }
        : v,
    );
  }

  async function newChat() {
    if (!selected) return;
    const c = await api.createConversation(selected.id, {});
    await loadConversations(selected.id);
    setView({ kind: "chat", conversationId: c.id });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar workspace={workspace} />
      <Sidebar
        workspaceName={workspaceName(workspace)}
        projects={projects}
        selected={selected}
        onSelect={openProject}
        onBack={() => setSelected(null)}
        onCreatedProject={() => void refresh()}
        connectors={connectors}
        catalog={catalog}
        conversations={conversations}
        view={view}
        onView={setView}
        onConnectorsChanged={() => void onConnectorsChanged()}
        onConversationsChanged={() => void onConversationsChanged()}
        onNewChat={() => void newChat()}
      />
      <main className="pt-14 md:pl-60">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          {error && (
            <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {selected ? (
            <ProjectMain
              project={selected}
              view={view}
              connectors={connectors}
              catalog={catalog}
              conversations={conversations}
              onProjectChanged={() => void refresh()}
              onProjectDeleted={() => {
                setSelected(null);
                void refresh();
              }}
              onConnectorChanged={() => void onConnectorsChanged()}
              onConversationsChanged={() => void onConversationsChanged()}
            />
          ) : (
            <ProjectsLanding
              loading={loading}
              projects={projects}
              onSelect={openProject}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ProjectMain({
  project,
  view,
  connectors,
  catalog,
  conversations,
  onProjectChanged,
  onProjectDeleted,
  onConnectorChanged,
  onConversationsChanged,
}: {
  project: Project;
  view: ProjectView;
  connectors: ConnectorInstance[];
  catalog: CatalogEntry[];
  conversations: Conversation[];
  onProjectChanged: () => void;
  onProjectDeleted: () => void;
  onConnectorChanged: () => void;
  onConversationsChanged: () => void;
}) {
  const connector =
    view.kind === "connector"
      ? connectors.find((c) => c.id === view.id)
      : undefined;
  const conversation =
    view.kind === "chat" && view.conversationId
      ? (conversations.find((c) => c.id === view.conversationId) ?? null)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project · {project.slug}
          </p>
        </div>
        <ProjectActions
          project={project}
          onChanged={onProjectChanged}
          onDeleted={onProjectDeleted}
        />
      </div>

      {view.kind === "overview" && (
        <ProjectOverview connectors={connectors} catalog={catalog} />
      )}
      {view.kind === "connector" &&
        (connector ? (
          <ConnectorDetail
            connector={connector}
            catalog={catalog}
            onChanged={onConnectorChanged}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Connector not found.</p>
        ))}
      {view.kind === "graph" && (
        <ComingSoon
          title="Graph"
          description="Visual map of this project's services and relationships."
          icon={<Network size={22} />}
        />
      )}
      {view.kind === "chat" && (
        <Chat
          conversation={conversation}
          connectors={connectors}
          onSaved={onConversationsChanged}
        />
      )}
    </div>
  );
}

function ProjectOverview({
  connectors,
  catalog,
}: {
  connectors: ConnectorInstance[];
  catalog: CatalogEntry[];
}) {
  if (connectors.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Plug size={28} className="text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No connectors yet.</p>
          <p className="text-xs text-muted-foreground">
            Use the <span className="font-medium text-foreground">+</span> next
            to “Connectors” in the sidebar.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Connectors ({connectors.length})
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {connectors.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <BrandIcon
              slug={catalog.find((x) => x.type === c.connectorType)?.icon ?? null}
              size={18}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.connectorType} · {layerLabel(c.layer)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectsLanding({
  loading,
  projects,
  onSelect,
}: {
  loading: boolean;
  projects: Project[];
  onSelect: (p: Project) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Projects
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Local-first projects, stored as folders on your machine — no database,
          no account.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FolderGit2 size={28} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <p className="text-xs text-muted-foreground">
              Use the <span className="font-medium text-foreground">+</span> next
              to “Projects” in the sidebar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-border/70 hover:bg-accent/5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderGit2 size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.slug}
                </span>
              </span>
              <ArrowRight
                size={16}
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
