import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Boxes,
  ChevronRight,
  Copy,
  Play,
  Plug,
  Save,
  Search,
  Send,
  Terminal,
  Trash2,
  Unplug,
} from "lucide-react";
import { LAYER_LABELS } from "@orbit/shared";
import {
  api,
  type ApiCatalogSchema,
  type ApiOperation,
  type ApiParam,
  type CapabilitySchema,
  type CatalogEntry,
  type ConnectorInstance,
  type ConnectorSchema,
  type JsonSchema,
  type JsonSchemaProp,
  type McpConfig,
  type RawApiResponse,
  type SavedRequest,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandIcon } from "@/components/ui/brand-icon";
import { SchemaForm, defaultsFor } from "@/components/schema-form";

function layerLabel(layer: string): string {
  return LAYER_LABELS[layer as keyof typeof LAYER_LABELS] ?? layer;
}

export function ConnectorDetail({
  connector,
  catalog,
  onChanged,
}: {
  connector: ConnectorInstance;
  catalog: CatalogEntry[];
  onChanged: () => void;
}) {
  const isCustom = connector.connectorType === "custom";
  const connected = connector.status === "connected";
  const iconSlug =
    catalog.find((c) => c.type === connector.connectorType)?.icon ?? null;

  const [schema, setSchema] = useState<ConnectorSchema | null>(null);
  const [creds, setCreds] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCustom) {
      setSchema(null);
      return;
    }
    let active = true;
    api
      .connectorSchema(connector.connectorType)
      .then((s) => {
        if (!active) return;
        setSchema(s);
        setCreds(defaultsFor(s.credentials));
      })
      .catch(() => active && setSchema(null));
    return () => {
      active = false;
    };
  }, [connector.connectorType, isCustom]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      await api.connect(connector.id, creds);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api.disconnect(connector.id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <BrandIcon slug={iconSlug} size={26} />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-lg font-medium">{connector.name}</p>
          <p className="text-sm text-muted-foreground">
            {connector.connectorType} · {layerLabel(connector.layer)}
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={
              connected
                ? "size-1.5 rounded-full bg-green-500"
                : "size-1.5 rounded-full bg-muted-foreground"
            }
          />
          {connector.status}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isCustom ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This is a custom (local) service — it has no live API/MCP connection.
          </CardContent>
        </Card>
      ) : connected ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Connected. Credentials are stored encrypted, outside the project
              folder.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnect}
              disabled={busy}
              className="gap-1.5"
            >
              <Unplug size={14} />
              Disconnect
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium">Connect</p>
            {schema ? (
              <>
                <SchemaForm
                  schema={schema.credentials}
                  values={creds}
                  onChange={setCreds}
                  secret
                />
                <div className="flex justify-end">
                  <Button onClick={connect} disabled={busy} className="gap-1.5">
                    <Plug size={14} />
                    {busy ? "Connecting…" : "Connect"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>
      )}

      {connected && schema && (
        <SurfaceTabs instanceId={connector.id} schema={schema} />
      )}
    </div>
  );
}

type SurfaceTab = "capabilities" | "api" | "mcp" | "cli";

/**
 * Tabs over a connector's surfaces. Conceptually two levels — Capabilities is
 * Orbit's curated layer (L1); API / MCP / CLI are the service's own surfaces
 * (L2). The divider in the tab bar keeps that hierarchy legible.
 */
function SurfaceTabs({
  instanceId,
  schema,
}: {
  instanceId: string;
  schema: ConnectorSchema;
}) {
  const [tab, setTab] = useState<SurfaceTab>("capabilities");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "capabilities"} onClick={() => setTab("capabilities")}>
          Capabilities
        </TabButton>
        <span className="mx-2 h-4 w-px bg-border" aria-hidden />
        <TabButton active={tab === "api"} onClick={() => setTab("api")}>
          API
        </TabButton>
        <TabButton active={tab === "mcp"} onClick={() => setTab("mcp")}>
          MCP
        </TabButton>
        <TabButton active={tab === "cli"} onClick={() => setTab("cli")}>
          CLI
        </TabButton>
      </div>

      {tab === "capabilities" && (
        <Panel sub="Orbit's curated, typed actions — also exposed to agents as an Orbit MCP server.">
          <CapabilitiesPanel
            instanceId={instanceId}
            capabilities={schema.capabilities}
          />
        </Panel>
      )}
      {tab === "api" && (
        <Panel sub="The service's full raw API surface — call any operation directly.">
          <ApiExplorer instanceId={instanceId} apiSchema={schema.api} />
        </Panel>
      )}
      {tab === "mcp" && (
        <Panel sub="The service's own MCP server (official or third-party).">
          <ComingSoonCard
            icon={<Boxes size={20} />}
            title="MCP — official server"
            description="Connect this service's official (or a third-party) MCP server and use its tools, resources and prompts."
          />
        </Panel>
      )}
      {tab === "cli" && (
        <Panel sub="The service's official command line.">
          <ComingSoonCard
            icon={<Terminal size={20} />}
            title="CLI — official command line"
            description="Run the service's official CLI from here, with a catalogue of single runnable commands."
          />
        </Panel>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({ sub, children }: { sub: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{sub}</p>
      {children}
    </div>
  );
}

function CapabilitiesPanel({
  instanceId,
  capabilities,
}: {
  instanceId: string;
  capabilities: CapabilitySchema[];
}) {
  const groups = useMemo(() => groupByTopic(capabilities), [capabilities]);
  const canGroup = groups.length > 1;
  const [grouped, setGrouped] = useState(true);
  const [openName, setOpenName] = useState<string | null>(null);
  const [openTopics, setOpenTopics] = useState<Set<string>>(
    () => new Set(groups.map(([t]) => t)),
  );

  if (capabilities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This connector has no curated capabilities.
      </p>
    );
  }

  const row = (c: CapabilitySchema) => (
    <CapabilityRow
      key={c.name}
      instanceId={instanceId}
      capability={c}
      open={openName === c.name}
      onToggle={() => setOpenName((cur) => (cur === c.name ? null : c.name))}
    />
  );

  return (
    <div className="space-y-2">
      <McpConfigCard instanceId={instanceId} />
      {canGroup && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setGrouped((g) => !g)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {grouped ? "Ungroup" : "Group by topic"}
          </button>
        </div>
      )}
      {grouped && canGroup
        ? groups.map(([topic, caps]) => (
            <CollapsibleGroup
              key={topic}
              title={topic}
              count={caps.length}
              open={openTopics.has(topic)}
              onToggle={() =>
                setOpenTopics((cur) => {
                  const next = new Set(cur);
                  next.has(topic) ? next.delete(topic) : next.add(topic);
                  return next;
                })
              }
            >
              {caps.map(row)}
            </CollapsibleGroup>
          ))
        : capabilities.map(row)}
    </div>
  );
}

/** Shows the MCP config snippet to wire this connection into an external agent. */
function McpConfigCard({ instanceId }: { instanceId: string }) {
  const [cfg, setCfg] = useState<McpConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api
      .mcpConfig(instanceId)
      .then(setCfg)
      .catch(() => setCfg(null));
  }, [instanceId]);

  if (!cfg) return null;

  const snippet = JSON.stringify(
    {
      mcpServers: {
        [cfg.key]: { command: cfg.command, args: cfg.args, env: cfg.env },
      },
    },
    null,
    2,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 text-left"
        >
          <Boxes size={15} className="shrink-0 text-primary" />
          <span className="text-sm font-medium">Use with an AI agent (MCP)</span>
          <ChevronRight
            size={14}
            className={`ml-auto shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>
        {open && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Orbit exposes these capabilities as an MCP server dedicated to this
              connection. Paste this into your agent's MCP config (e.g. Claude
              Desktop's <span className="font-mono">mcpServers</span>):
            </p>
            <div className="relative">
              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 pr-20 text-xs">
                {snippet}
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={copy}
                className="absolute right-2 top-2 gap-1.5"
              >
                <Copy size={12} />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Tier-2 explorer: saved requests + search + topic groups over the full surface. */
function ApiExplorer({
  instanceId,
  apiSchema,
}: {
  instanceId: string;
  apiSchema: ApiCatalogSchema;
}) {
  const [query, setQuery] = useState("");
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRequest[]>([]);
  const [savedOpen, setSavedOpen] = useState(true);

  const reloadSaved = () => {
    void api
      .listSavedRequests(instanceId)
      .then(setSaved)
      .catch(() => setSaved([]));
  };
  useEffect(reloadSaved, [instanceId]);

  if (!apiSchema.canCall || apiSchema.operations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This connector has no raw API surface.
      </p>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? apiSchema.operations.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.path.toLowerCase().includes(q) ||
          o.summary.toLowerCase().includes(q),
      )
    : apiSchema.operations;
  const groups = groupByTopic(filtered);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search operations (path, name, summary)…"
          className="pl-8"
        />
      </div>

      {saved.length > 0 && (
        <CollapsibleGroup
          title="Saved"
          count={saved.length}
          open={savedOpen}
          onToggle={() => setSavedOpen((o) => !o)}
        >
          {saved.map((sr) => (
            <SavedRequestRow
              key={sr.id}
              instanceId={instanceId}
              saved={sr}
              open={openId === sr.id}
              onToggle={() =>
                setOpenId((cur) => (cur === sr.id ? null : sr.id))
              }
              onDeleted={reloadSaved}
            />
          ))}
        </CollapsibleGroup>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} operations · {groups.length} topics
      </p>
      <div className="space-y-1.5">
        {groups.map(([topic, ops]) => (
          <TopicGroup
            key={topic}
            instanceId={instanceId}
            topic={topic}
            ops={ops}
            open={q !== "" || openTopics.has(topic)}
            onToggle={() =>
              setOpenTopics((cur) => {
                const next = new Set(cur);
                next.has(topic) ? next.delete(topic) : next.add(topic);
                return next;
              })
            }
            openId={openId}
            onOpenId={setOpenId}
            onSaved={reloadSaved}
          />
        ))}
      </div>
    </div>
  );
}

/** A collapsible, titled group with a count badge — shared by API and Capabilities. */
function CollapsibleGroup({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/5"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="secondary" className="ml-auto font-normal">
          {count}
        </Badge>
      </button>
      {open && <div className="space-y-2 pl-2">{children}</div>}
    </div>
  );
}

function TopicGroup({
  instanceId,
  topic,
  ops,
  open,
  onToggle,
  openId,
  onOpenId,
  onSaved,
}: {
  instanceId: string;
  topic: string;
  ops: ApiOperation[];
  open: boolean;
  onToggle: () => void;
  openId: string | null;
  onOpenId: (id: string | null) => void;
  onSaved: () => void;
}) {
  return (
    <CollapsibleGroup
      title={topic}
      count={ops.length}
      open={open}
      onToggle={onToggle}
    >
      {ops.map((op) => (
        <ApiOperationRow
          key={op.id}
          instanceId={instanceId}
          op={op}
          open={openId === op.id}
          onToggle={() => onOpenId(openId === op.id ? null : op.id)}
          onSaved={onSaved}
        />
      ))}
    </CollapsibleGroup>
  );
}

/** Shared collapsible row: a clickable header that expands to a body. */
function ExpandableRow({
  open,
  onToggle,
  header,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 text-left"
        >
          <ChevronRight
            size={14}
            className={`shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          {header}
        </button>
        {open && (
          <div className="space-y-3 border-t border-border pt-3">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function CapabilityRow({
  instanceId,
  capability,
  open,
  onToggle,
}: {
  instanceId: string;
  capability: CapabilitySchema;
  open: boolean;
  onToggle: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    defaultsFor(capability.input),
  );
  const [result, setResult] = useState<unknown>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const r = await api.invoke(instanceId, capability.name, values);
      setResult(r.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <ExpandableRow
      open={open}
      onToggle={onToggle}
      header={
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {capability.title}
          </span>
          <Badge
            variant={capability.readOnly ? "secondary" : "default"}
            className="font-normal"
          >
            {capability.readOnly ? "read-only" : "write"}
          </Badge>
        </>
      }
    >
      {capability.description && (
        <p className="text-xs text-muted-foreground">{capability.description}</p>
      )}
      <SchemaForm
        schema={capability.input}
        values={values}
        onChange={setValues}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={run} disabled={running} className="gap-1.5">
          <Play size={13} />
          {running ? "Running…" : "Run"}
        </Button>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {result !== undefined && (
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </ExpandableRow>
  );
}

function ApiOperationRow({
  instanceId,
  op,
  open,
  onToggle,
  onSaved,
}: {
  instanceId: string;
  op: ApiOperation;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const pathSchema = useMemo(() => paramsSchema(op.parameters, "path"), [op]);
  const querySchema = useMemo(() => paramsSchema(op.parameters, "query"), [op]);
  const body = useMemo(() => bodyForm(op.requestSchema), [op]);

  const [pathVals, setPathVals] = useState<Record<string, unknown>>(() =>
    defaultsFor(pathSchema),
  );
  const [queryVals, setQueryVals] = useState<Record<string, unknown>>(() =>
    defaultsFor(querySchema),
  );
  const [bodyVals, setBodyVals] = useState<Record<string, unknown>>(() =>
    defaultsFor(body?.schema),
  );
  const [bodyJson, setBodyJson] = useState("");
  const [result, setResult] = useState<RawApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  /** Compose the call from the current form values (shared by Send and Save). */
  function buildCall(): {
    pathParams: Record<string, string | number>;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  } {
    let payload: unknown;
    if (body) {
      const b = pruneEmpty(bodyVals);
      if (bodyJson.trim()) {
        let extra: Record<string, unknown>;
        try {
          extra = JSON.parse(bodyJson);
        } catch {
          throw new Error("Request body JSON is invalid");
        }
        Object.assign(b, extra);
      }
      if (Object.keys(b).length) payload = b;
    }
    const query = pruneEmpty(queryVals) as Record<
      string,
      string | number | boolean | undefined
    >;
    return {
      pathParams: pruneEmpty(pathVals) as Record<string, string | number>,
      query: Object.keys(query).length ? query : undefined,
      body: payload,
    };
  }

  async function send() {
    setRunning(true);
    setError(null);
    try {
      const r = await api.callApi(instanceId, {
        operationId: op.id,
        ...buildCall(),
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const call = buildCall();
      await api.saveRequest(instanceId, {
        name: saveName.trim() || op.summary || op.id,
        topic: op.topic,
        operationId: op.id,
        pathParams: call.pathParams,
        query: call.query,
        body: call.body,
      });
      setSaveName("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ExpandableRow
      open={open}
      onToggle={onToggle}
      header={
        <>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {op.method}
          </Badge>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            {op.path}
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">
            {op.summary}
          </span>
        </>
      }
    >
      {hasFields(pathSchema) && (
        <FormBlock label="Path">
          <SchemaForm
            schema={pathSchema}
            values={pathVals}
            onChange={setPathVals}
          />
        </FormBlock>
      )}
      {hasFields(querySchema) && (
        <FormBlock label="Query">
          <SchemaForm
            schema={querySchema}
            values={queryVals}
            onChange={setQueryVals}
          />
        </FormBlock>
      )}
      {body && (
        <FormBlock label="Body">
          {hasFields(body.schema) && (
            <SchemaForm
              schema={body.schema}
              values={bodyVals}
              onChange={setBodyVals}
            />
          )}
          {body.nestedPlaceholder !== null && (
            <div className="space-y-1.5">
              <Label htmlFor={`${op.id}-bjson`}>
                {hasFields(body.schema)
                  ? "more fields (JSON, merged)"
                  : "body (JSON)"}
              </Label>
              <textarea
                id={`${op.id}-bjson`}
                value={bodyJson}
                onChange={(e) => setBodyJson(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={body.nestedPlaceholder}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
        </FormBlock>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {op.docsUrl ? (
          <a
            href={op.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Docs
          </a>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="save as…"
            className="h-8 w-28 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={save}
            disabled={saving}
            className="gap-1.5"
          >
            <Save size={13} />
            {saving ? "…" : "Save"}
          </Button>
          <Button
            size="sm"
            onClick={send}
            disabled={running}
            className="gap-1.5"
          >
            <Send size={13} />
            {running ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Status {result.status}</p>
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </ExpandableRow>
  );
}

/** A reusable saved request — replay (Run) or remove it. */
function SavedRequestRow({
  instanceId,
  saved,
  open,
  onToggle,
  onDeleted,
}: {
  instanceId: string;
  saved: SavedRequest;
  open: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const [result, setResult] = useState<RawApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const r = await api.callApi(instanceId, {
        operationId: saved.operationId,
        method: saved.method,
        path: saved.path,
        pathParams: saved.pathParams,
        query: saved.query,
        body: saved.body,
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteSavedRequest(saved.id);
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  const target =
    saved.operationId ?? `${saved.method ?? ""} ${saved.path ?? ""}`.trim();

  return (
    <ExpandableRow
      open={open}
      onToggle={onToggle}
      header={
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {saved.name}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {target}
          </span>
        </>
      }
    >
      <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(
          {
            pathParams: saved.pathParams,
            query: saved.query,
            body: saved.body,
          },
          null,
          2,
        )}
      </pre>
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={remove}
          disabled={deleting}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 size={13} />
          {deleting ? "…" : "Delete"}
        </Button>
        <Button size="sm" onClick={run} disabled={running} className="gap-1.5">
          <Play size={13} />
          {running ? "Running…" : "Run"}
        </Button>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Status {result.status}</p>
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </ExpandableRow>
  );
}

function FormBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-xs text-muted-foreground">{description}</p>
        <Badge variant="secondary" className="font-normal">
          Coming soon
        </Badge>
      </CardContent>
    </Card>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function groupByTopic<T extends { topic: string }>(
  items: T[],
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const arr = map.get(it.topic) ?? [];
    arr.push(it);
    map.set(it.topic, arr);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Build a flat JSON Schema for the path|query parameters of an operation. */
function paramsSchema(
  params: ApiParam[] | undefined,
  where: "path" | "query",
): JsonSchema {
  const properties: Record<string, JsonSchemaProp> = {};
  const required: string[] = [];
  for (const p of params ?? []) {
    if (p.in !== where) continue;
    properties[p.name] = {
      ...(p.schema ?? { type: "string" }),
      description: p.description,
    };
    if (p.required) required.push(p.name);
  }
  return { type: "object", properties, required };
}

function hasFields(schema: JsonSchema): boolean {
  return Object.keys(schema.properties ?? {}).length > 0;
}

function isScalarProp(s: JsonSchemaProp): boolean {
  const t = s.type;
  return (
    Boolean(s.enum) ||
    t === "string" ||
    t === "number" ||
    t === "integer" ||
    t === "boolean"
  );
}

/**
 * Split a request body schema into a flat form (scalar top-level fields) plus a
 * JSON-editor placeholder for the rest — the "fallback A" we agreed on.
 */
function bodyForm(
  requestSchema: JsonSchema | undefined,
): { schema: JsonSchema; nestedPlaceholder: string | null } | null {
  if (!requestSchema) return null;
  const props = requestSchema.properties ?? {};
  const scalar: Record<string, JsonSchemaProp> = {};
  const nested: Record<string, JsonSchemaProp> = {};
  for (const [k, v] of Object.entries(props)) {
    (isScalarProp(v) ? scalar : nested)[k] = v;
  }
  const required = (requestSchema.required ?? []).filter((r) => scalar[r]);

  const hasNested =
    Object.keys(nested).length > 0 || Object.keys(props).length === 0;
  let nestedPlaceholder: string | null = null;
  if (hasNested) {
    const skeleton: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nested)) {
      skeleton[k] = v.type === "array" ? [] : {};
    }
    nestedPlaceholder = JSON.stringify(skeleton, null, 2);
  }
  return {
    schema: { type: "object", properties: scalar, required },
    nestedPlaceholder,
  };
}

function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}
