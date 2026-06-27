import { type FormEvent, useEffect, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Pencil,
  Plug,
  PlugZap,
  Plus,
  Server,
  Sparkles,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import {
  api,
  type DiscoveredMcpServer,
  type McpServer,
  type McpTransport,
  type OfficialMcpSpec,
} from "@/lib/api";
import { MCP_PRESETS, type McpPreset } from "@/lib/mcp-presets";

/** Heuristic for which detected env/header keys to pre-flag as secret on import. */
const SECRET_KEY_RE = /token|key|secret|password|auth|bearer|pat/i;
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KvRow {
  key: string;
  value: string;
  secret: boolean;
}

/** Seed values for the add form, e.g. from a connector's official MCP spec. */
interface McpPrefill {
  name: string;
  transport: McpTransport;
  command: string;
  args: string;
  url: string;
  rows: KvRow[];
}

/** Build add-form seed values from a connector's declared official MCP server. */
function prefillFromOfficial(
  spec: OfficialMcpSpec,
  connectorName: string,
): McpPrefill {
  const rows: KvRow[] = [];
  for (const [k, v] of Object.entries(spec.env ?? {}))
    rows.push({ key: k, value: v, secret: false });
  for (const [k, v] of Object.entries(spec.headers ?? {}))
    rows.push({ key: k, value: v, secret: false });
  for (const k of spec.secretKeys ?? [])
    rows.push({ key: k, value: "", secret: true });
  return {
    name: `${connectorName} (official)`,
    transport: spec.transport,
    command: spec.command ?? "npx",
    args: (spec.args ?? []).join(" "),
    url: spec.url ?? "",
    rows,
  };
}

/**
 * The MCP surface of a connector instance: the external MCP server(s) Orbit
 * connects to for this integration (official, third-party, or — for custom
 * connectors — a standalone local tool). Add one (stdio command or remote
 * http/sse), connect it, and its tools join this project's chat tool pool.
 * Secrets never touch the synced `.orbit/` record — they go to the SecretStore.
 */
export function McpServersPanel({
  connectorInstanceId,
  connectorName = "This connector",
  officialMcp = null,
}: {
  connectorInstanceId: string;
  connectorName?: string;
  officialMcp?: OfficialMcpSpec | null;
}) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [prefill, setPrefill] = useState<McpPrefill | null>(null);
  const [editing, setEditing] = useState<McpServer | null>(null);

  async function load() {
    try {
      setServers(await api.listMcpServers(connectorInstanceId));
    } catch {
      setServers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectorInstanceId]);

  function openAdd(seed: McpPrefill | null) {
    setEditing(null);
    setPrefill(seed);
    setAddOpen(true);
  }

  function openEdit(server: McpServer) {
    setPrefill(null);
    setEditing(server);
    setAddOpen(true);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => openAdd(null)}>
          <Plus size={15} />
          Add server
        </Button>
      </div>

      {officialMcp && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <Sparkles size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Official MCP server
                </span>
                <Badge variant="outline" className="uppercase">
                  {officialMcp.transport}
                </Badge>
              </div>
              {officialMcp.description && (
                <p className="text-xs text-muted-foreground">
                  {officialMcp.description}
                </p>
              )}
              {officialMcp.docsUrl && (
                <a
                  href={officialMcp.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink size={12} />
                  Documentation
                </a>
              )}
            </div>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => openAdd(prefillFromOfficial(officialMcp, connectorName))}
            >
              <Plus size={15} />
              Add
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Server size={28} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No MCP servers yet.</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              e.g. <span className="font-mono">npx</span>{" "}
              <span className="font-mono">
                -y @modelcontextprotocol/server-filesystem /path
              </span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {servers.map((s) => (
            <McpServerCard
              key={s.id}
              server={s}
              onChanged={() => void load()}
              onEdit={() => openEdit(s)}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <AddMcpServerDialog
          connectorInstanceId={connectorInstanceId}
          prefill={prefill}
          editing={editing}
          open={addOpen}
          onOpenChange={setAddOpen}
          onCreated={() => void load()}
        />
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: McpServer["status"] }) {
  if (status === "connected")
    return <Badge variant="secondary">Connected</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="outline">Configured</Badge>;
}

function McpServerCard({
  server,
  onChanged,
  onEdit,
}: {
  server: McpServer;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(server.lastError ?? null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const connected = server.status === "connected";

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-3">
        <div className="flex items-center gap-3">
          <Server size={16} className="shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">
                {server.name}
              </span>
              <StatusBadge status={server.status} />
              {connected && server.toolCount !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {server.toolCount} tool{server.toolCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {server.transport === "stdio"
                ? `${server.command} ${server.args.join(" ")}`
                : `${server.transport.toUpperCase()} · ${server.url ?? ""}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={
                server.enabled
                  ? "Tools join this project's chat. Toggle off to exclude them."
                  : "Disabled — tools are kept out of the chat (e.g. to avoid duplicates)."
              }
            >
              <Switch
                checked={server.enabled}
                disabled={busy}
                onCheckedChange={(v) =>
                  run(() => api.setMcpServerEnabled(server.id, v))
                }
              />
              {server.enabled ? "Enabled" : "Disabled"}
            </label>
            {connected ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => run(() => api.disconnectMcpServer(server.id))}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Unplug size={14} />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => api.connectMcpServer(server.id))}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <PlugZap size={14} />
                )}
                Connect
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              disabled={busy}
              onClick={onEdit}
              title="Edit"
            >
              <Pencil size={14} />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={() => run(() => api.deleteMcpServer(server.id))}
              title="Delete"
            >
              <Trash2 size={14} />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Non-secret env/headers of a server → editable rows (secrets aren't returned,
 *  so they show as empty secret rows the user can re-enter to change them). */
function rowsFromServer(s: McpServer): KvRow[] {
  const kv = s.transport === "stdio" ? s.env : (s.headers ?? {});
  return Object.entries(kv).map(([key, value]) => ({
    key,
    value,
    secret: false,
  }));
}

function AddMcpServerDialog({
  connectorInstanceId,
  prefill,
  editing,
  open,
  onOpenChange,
  onCreated,
}: {
  connectorInstanceId: string;
  prefill?: McpPrefill | null;
  /** When set, the dialog edits this server (PATCH) instead of creating. */
  editing?: McpServer | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const isEditing = !!editing;
  const [name, setName] = useState(editing?.name ?? prefill?.name ?? "");
  const [transport, setTransport] = useState<McpTransport>(
    editing?.transport ?? prefill?.transport ?? "stdio",
  );
  const [command, setCommand] = useState(
    editing?.command || prefill?.command || "npx",
  );
  const [args, setArgs] = useState(
    editing ? editing.args.join(" ") : (prefill?.args ?? ""),
  );
  const [url, setUrl] = useState(editing?.url ?? prefill?.url ?? "");
  const [rows, setRows] = useState<KvRow[]>(
    editing ? rowsFromServer(editing) : (prefill?.rows ?? []),
  );
  const [connectNow, setConnectNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState<DiscoveredMcpServer[]>([]);

  const isStdio = transport === "stdio";

  useEffect(() => {
    if (isEditing) return; // discovery/presets only when creating
    api.discoverMcpServers().then(setDetected).catch(() => setDetected([]));
  }, [isEditing]);

  function setRow(i: number, patch: Partial<KvRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function applyDetected(d: DiscoveredMcpServer) {
    setName(d.name);
    setTransport(d.transport);
    setCommand(d.command ?? "npx");
    setArgs((d.args ?? []).join(" "));
    setUrl(d.url ?? "");
    const kv = d.transport === "stdio" ? d.env : d.headers;
    setRows(
      Object.entries(kv ?? {}).map(([k, v]) => ({
        key: k,
        value: v,
        secret: SECRET_KEY_RE.test(k),
      })),
    );
  }

  function applyPreset(p: McpPreset) {
    setName(p.name);
    setTransport(p.transport);
    setCommand(p.command ?? "npx");
    setArgs((p.args ?? []).join(" "));
    setUrl(p.url ?? "");
    const next: KvRow[] = [];
    for (const [k, v] of Object.entries(p.env ?? {}))
      next.push({ key: k, value: v, secret: false });
    for (const k of p.secretKeys ?? [])
      next.push({ key: k, value: "", secret: true });
    setRows(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // One key/value table serves both env vars (stdio) and request headers
      // (http/sse); secrets are split out of the synced record either way.
      const plain: Record<string, string> = {};
      const secret: Record<string, string> = {};
      for (const r of rows) {
        if (!r.key.trim()) continue;
        // When editing, a blank secret row means "keep the stored value" —
        // skip it so we don't overwrite the SecretStore with an empty string.
        if (r.secret && isEditing && !r.value) continue;
        (r.secret ? secret : plain)[r.key.trim()] = r.value;
      }

      if (isEditing && editing) {
        // PATCH the record (incl. a possibly-changed transport), then reconnect
        // if asked — secrets re-applied on connect (they're never read back).
        await api.updateMcpServer(
          editing.id,
          isStdio
            ? {
                name: name.trim(),
                transport,
                command: command.trim(),
                args: args.trim() ? args.trim().split(/\s+/) : [],
                env: plain,
              }
            : {
                name: name.trim(),
                transport,
                url: url.trim(),
                headers: plain,
              },
        );
        if (connectNow) {
          const secrets = Object.keys(secret).length
            ? isStdio
              ? { secretEnv: secret }
              : { secretHeaders: secret }
            : undefined;
          await api.connectMcpServer(editing.id, secrets).catch((e) => {
            throw new Error(`Saved, but connect failed: ${(e as Error).message}`);
          });
        }
        onOpenChange(false);
        onCreated();
        return;
      }

      const created = await api.createMcpServer(
        connectorInstanceId,
        isStdio
          ? {
              name: name.trim(),
              transport,
              command: command.trim(),
              args: args.trim() ? args.trim().split(/\s+/) : [],
              env: plain,
              ...(Object.keys(secret).length && { secretEnv: secret }),
            }
          : {
              name: name.trim(),
              transport,
              url: url.trim(),
              headers: plain,
              ...(Object.keys(secret).length && { secretHeaders: secret }),
            },
      );
      if (connectNow) {
        // Best-effort: surface a connect failure but keep the created server.
        await api.connectMcpServer(created.id).catch((e) => {
          throw new Error(`Created, but connect failed: ${(e as Error).message}`);
        });
      }
      onOpenChange(false);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit MCP server" : "Add MCP server"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="mcp-preset">Start from a preset</Label>
              <Select
                value=""
                onValueChange={(id) => {
                  const p = MCP_PRESETS.find((x) => x.id === id);
                  if (p) applyPreset(p);
                }}
              >
                <SelectTrigger id="mcp-preset">
                  <SelectValue placeholder="Custom — fill manually" />
                </SelectTrigger>
                <SelectContent>
                  {MCP_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!isEditing && detected.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="mcp-detected">Detected on this machine</Label>
              <Select
                value=""
                onValueChange={(i) => {
                  const d = detected[Number(i)];
                  if (d) applyDetected(d);
                }}
              >
                <SelectTrigger id="mcp-detected">
                  <SelectValue placeholder="Import from Claude / Cursor / Windsurf" />
                </SelectTrigger>
                <SelectContent>
                  {detected.map((d, i) => (
                    <SelectItem key={`${d.source}-${d.name}-${i}`} value={String(i)}>
                      {d.name} · {d.source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Review the values — secret-looking keys are pre-flagged and kept
                out of the project folder.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="mcp-name">Name</Label>
            <Input
              id="mcp-name"
              value={name}
              required
              placeholder="Filesystem"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-transport">Transport</Label>
            <Select
              value={transport}
              onValueChange={(v) => setTransport(v as McpTransport)}
            >
              <SelectTrigger id="mcp-transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">Local process (stdio)</SelectItem>
                <SelectItem value="http">Remote — HTTP (streamable)</SelectItem>
                <SelectItem value="sse">Remote — SSE (legacy)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isStdio ? (
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="mcp-cmd">Command</Label>
                <Input
                  id="mcp-cmd"
                  value={command}
                  required
                  className="font-mono"
                  onChange={(e) => setCommand(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mcp-args">Arguments</Label>
                <Input
                  id="mcp-args"
                  value={args}
                  className="font-mono"
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                  onChange={(e) => setArgs(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="mcp-url">Server URL</Label>
              <Input
                id="mcp-url"
                value={url}
                required
                type="url"
                className="font-mono"
                placeholder="https://example.com/mcp"
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{isStdio ? "Environment variables" : "Headers"}</Label>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  setRows((r) => [...r, { key: "", value: "", secret: false }])
                }
                title={isStdio ? "Add variable" : "Add header"}
              >
                <Plus size={14} />
                <span className="sr-only">Add variable</span>
              </Button>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.key}
                  placeholder={isStdio ? "KEY" : "Header-Name"}
                  className="font-mono"
                  onChange={(e) => setRow(i, { key: e.target.value })}
                />
                <Input
                  value={row.value}
                  type={row.secret ? "password" : "text"}
                  placeholder="value"
                  className="font-mono"
                  onChange={(e) => setRow(i, { value: e.target.value })}
                />
                <label
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                  title="Store encrypted in the SecretStore (kept out of .orbit/)"
                >
                  <input
                    type="checkbox"
                    checked={row.secret}
                    onChange={(e) => setRow(i, { secret: e.target.checked })}
                  />
                  secret
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setRows((r) => r.filter((_, idx) => idx !== i))
                  }
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>

          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Secret values aren&apos;t shown — re-enter a secret row only to
              change it; leave it blank to keep the stored value.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={connectNow}
              onChange={(e) => setConnectNow(e.target.checked)}
            />
            {isEditing
              ? "Reconnect now (apply changes and reload tools)"
              : "Connect now (spawn the server and load its tools)"}
          </label>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {isEditing ? "Saving…" : "Adding…"}
                </>
              ) : (
                <>
                  <Plug size={14} />
                  {isEditing ? "Save" : "Add"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
