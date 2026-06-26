import type { ReactNode } from "react";
import {
  ChevronLeft,
  FolderGit2,
  LayoutDashboard,
  Network,
  Plus,
} from "lucide-react";
import type {
  CatalogEntry,
  ConnectorInstance,
  Conversation,
  Project,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "./create-project-dialog";
import { CreateConnectorDialog } from "./create-connector-dialog";
import { ConnectorRow } from "./connector-row";
import { ChatSessionRow } from "./chat-session-row";

export type ProjectView =
  | { kind: "overview" }
  | { kind: "graph" }
  | { kind: "chat"; conversationId?: string }
  | { kind: "connector"; id: string };

interface SidebarProps {
  workspaceName: string;
  projects: Project[];
  selected: Project | null;
  onSelect: (p: Project) => void;
  onBack: () => void;
  onCreatedProject: () => void;
  connectors: ConnectorInstance[];
  catalog: CatalogEntry[];
  conversations: Conversation[];
  view: ProjectView;
  onView: (v: ProjectView) => void;
  onConnectorsChanged: () => void;
  onConversationsChanged: () => void;
  onNewChat: () => void;
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="fixed bottom-0 left-0 top-14 hidden w-60 border-r border-border bg-card md:block">
      <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
        {props.selected ? (
          <ProjectNav {...props} selected={props.selected} />
        ) : (
          <ProjectList {...props} />
        )}
      </nav>
    </aside>
  );
}

function ProjectList({
  workspaceName,
  projects,
  onSelect,
  onCreatedProject,
}: SidebarProps) {
  return (
    <>
      <p className="truncate px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {workspaceName}
      </p>

      <Separator />

      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Projects
        </p>
        <CreateProjectDialog onCreated={onCreatedProject} />
      </div>

      {projects.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          No projects yet.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {projects.map((p) => (
            <NavButton key={p.id} onClick={() => onSelect(p)}>
              <FolderGit2 size={15} className="text-muted-foreground" />
              <span className="truncate">{p.name}</span>
            </NavButton>
          ))}
        </div>
      )}
    </>
  );
}

function ProjectNav({
  selected,
  connectors,
  catalog,
  conversations,
  view,
  onBack,
  onView,
  onConnectorsChanged,
  onConversationsChanged,
  onNewChat,
}: SidebarProps & { selected: Project }) {
  return (
    <>
      <button
        onClick={onBack}
        className="mb-1 flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft size={13} />
        Projects
      </button>

      <p className="truncate px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {selected.name}
      </p>

      <NavButton
        active={view.kind === "overview"}
        onClick={() => onView({ kind: "overview" })}
      >
        <LayoutDashboard size={15} />
        Overview
      </NavButton>
      <NavButton
        active={view.kind === "graph"}
        onClick={() => onView({ kind: "graph" })}
      >
        <Network size={15} />
        Graph
      </NavButton>

      <Separator />

      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chat
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          onClick={onNewChat}
          title="New chat"
        >
          <Plus size={14} />
          <span className="sr-only">New chat</span>
        </Button>
      </div>

      {conversations.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">No chats yet.</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {conversations.map((c) => (
            <ChatSessionRow
              key={c.id}
              conversation={c}
              active={
                view.kind === "chat" && view.conversationId === c.id
              }
              onSelect={() =>
                onView({ kind: "chat", conversationId: c.id })
              }
              onChanged={onConversationsChanged}
            />
          ))}
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Connectors
        </p>
        <CreateConnectorDialog
          projectId={selected.id}
          onCreated={onConnectorsChanged}
        />
      </div>

      {connectors.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          No connectors yet.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {connectors.map((c) => (
            <ConnectorRow
              key={c.id}
              connector={c}
              catalog={catalog}
              active={view.kind === "connector" && view.id === c.id}
              onSelect={() => onView({ kind: "connector", id: c.id })}
              onChanged={onConnectorsChanged}
            />
          ))}
        </div>
      )}
    </>
  );
}

function NavButton({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="my-2 h-px bg-border" />;
}
