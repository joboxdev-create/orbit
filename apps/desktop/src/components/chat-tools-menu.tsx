import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { api, type ConnectorInstance, type McpServer } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

/** A connected connector that contributes curated capabilities as agent tools. */
interface ConnectorToolSource {
  instance: ConnectorInstance;
  /** All curated capability names for this connector type. */
  capabilityNames: string[];
}

/**
 * The agent's tool sources for this project, toggleable from the chat composer.
 * Two parallel sections, both mirroring their per-connector tab switches and
 * sharing the same persisted flags so the surfaces never drift:
 *  - **Connectors** — each connected connector's curated capabilities (master
 *    on/off via `disabledCapabilities`; fine-grained toggles live in the tab).
 *  - **MCP servers** — each connected & enabled MCP server (`enabled` flag).
 * Toggling a source off keeps its tools out of the agent (e.g. to avoid
 * duplicating the same action across a capability and an MCP tool).
 */
export function ChatToolsMenu({ projectId }: { projectId: string }) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [connectors, setConnectors] = useState<ConnectorToolSource[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      setServers(await api.listProjectMcpServers(projectId));
    } catch {
      setServers([]);
    }
    try {
      const instances = await api.listConnectors(projectId);
      // Only connected, code-backed, non-model connectors expose agent tools.
      const eligible = instances.filter(
        (c) =>
          c.status === "connected" &&
          c.connectorType !== "custom" &&
          c.layer !== "model",
      );
      const schemaCache = new Map<string, string[]>();
      const sources: ConnectorToolSource[] = [];
      for (const inst of eligible) {
        let names = schemaCache.get(inst.connectorType);
        if (!names) {
          try {
            const schema = await api.connectorSchema(inst.connectorType);
            names = schema.capabilities.map((c) => c.name);
          } catch {
            names = [];
          }
          schemaCache.set(inst.connectorType, names);
        }
        if (names.length > 0) sources.push({ instance: inst, capabilityNames: names });
      }
      setConnectors(sources);
    } catch {
      setConnectors([]);
    }
  }

  // Refresh when the menu opens so the tab and chat never drift.
  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  async function toggle(server: McpServer, enabled: boolean) {
    // Optimistic; reconcile from the response.
    setServers((ss) =>
      ss.map((s) => (s.id === server.id ? { ...s, enabled } : s)),
    );
    try {
      const updated = await api.setMcpServerEnabled(server.id, enabled);
      setServers((ss) => ss.map((s) => (s.id === server.id ? updated : s)));
    } catch {
      void load();
    }
  }

  async function toggleConnector(src: ConnectorToolSource, enabled: boolean) {
    // Master switch: enable all (empty disabled set) or disable all capabilities.
    const disabledCapabilities = enabled ? [] : [...src.capabilityNames];
    setConnectors((cs) =>
      cs.map((c) =>
        c.instance.id === src.instance.id
          ? { ...c, instance: { ...c.instance, disabledCapabilities } }
          : c,
      ),
    );
    try {
      await api.updateConnector(src.instance.id, { disabledCapabilities });
    } catch {
      void load();
    }
  }

  const activeCount =
    servers.filter((s) => s.enabled && s.status === "connected").length +
    connectors.filter((c) => c.instance.disabledCapabilities.length < c.capabilityNames.length)
      .length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-muted-foreground"
          title="Tool sources for the agent"
        >
          <Wrench size={15} />
          Tools
          {activeCount > 0 && (
            <span className="rounded bg-primary/10 px-1 text-xs font-medium text-primary">
              {activeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Connector capabilities
        </p>
        <DropdownMenuSeparator />
        {connectors.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No connected connectors with capabilities in this project.
          </p>
        ) : (
          connectors.map((c) => {
            const total = c.capabilityNames.length;
            const enabledCount = total - c.instance.disabledCapabilities.length;
            const on = enabledCount > 0;
            return (
              <div
                key={c.instance.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{c.instance.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {enabledCount}/{total} capabilit{total === 1 ? "y" : "ies"}
                  </p>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => void toggleConnector(c, v)}
                  title="Offer this connector's capabilities to the agent"
                />
              </div>
            );
          })
        )}
        <p className="px-2 pb-1.5 pt-3 text-xs font-medium text-muted-foreground">
          MCP tool sources
        </p>
        <DropdownMenuSeparator />
        {servers.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No MCP servers in this project. Add one from a connector's MCP tab.
          </p>
        ) : (
          servers.map((s) => {
            const connected = s.status === "connected";
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {connected
                      ? `${s.toolCount ?? 0} tool${s.toolCount === 1 ? "" : "s"}`
                      : "not connected"}
                  </p>
                </div>
                <Switch
                  checked={s.enabled}
                  disabled={!connected}
                  onCheckedChange={(v) => void toggle(s, v)}
                  title={
                    connected
                      ? "Include this server's tools"
                      : "Connect the server first (in its MCP tab)"
                  }
                />
              </div>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
