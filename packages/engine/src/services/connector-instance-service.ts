import {
  mcpToolsFromConnector,
  type ChatMessage,
  type ConnectorContext,
  type ConnectorDefinition,
  type ConnectorRegistry,
  type HttpMethod,
  type ModelChatInput,
  type ModelChatResult,
  type ModelTool,
  type RawApiResponse,
  type ToolCall,
} from "@orbit/connector-sdk";
import type { ZodType } from "zod";
import {
  type ConnectorInstanceRecord,
  type ConnectorInstanceRepository,
  CUSTOM_CONNECTOR_TYPE,
  type UpdateConnectorInstanceData,
} from "../domain/connector-instance.js";
import type { SecretStore } from "../domain/secret-store.js";
import { badRequest, notFound } from "../errors.js";

export interface RegisterConnectorInput {
  /** "catalog" = a code-backed connector from the registry; "custom" = a
   *  user-declared service that has no live integration yet. */
  source: "catalog" | "custom";
  name: string;
  /** Required when source is "catalog". */
  connectorType?: string;
  /** Required when source is "custom". */
  layer?: string;
  config?: Record<string, unknown>;
}

export interface UpdateConnectorInput {
  name?: string;
  layer?: string;
  config?: Record<string, unknown>;
}

/**
 * A generic (Tier-2) API call: either reference a catalogued operation by id
 * (path params filled from `pathParams`) or pass a raw `method` + `path`.
 */
export interface CallApiInput {
  operationId?: string;
  method?: HttpMethod;
  path?: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface EngineLogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

const noopLogger: EngineLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface ConnectorInstanceServiceDeps {
  repo: ConnectorInstanceRepository;
  registry: ConnectorRegistry;
  /** Required for the credentialed flows (connect / disconnect / invoke). */
  secrets?: SecretStore;
  /** Defaults to the global fetch. */
  fetch?: typeof fetch;
  logger?: EngineLogger;
}

/**
 * Host-neutral domain logic for connector instances. Knows nothing about HTTP,
 * users or RBAC — governance lives in the host above this. The same instance
 * runs over a Prisma store (server) or a filesystem store (desktop) by swapping
 * the {@link ConnectorInstanceRepository}; credentials are kept out of the
 * record via the pluggable {@link SecretStore}.
 */
export class ConnectorInstanceService {
  constructor(private readonly deps: ConnectorInstanceServiceDeps) {}

  /**
   * Register a connector in a project without credentials (status
   * "configured"). Catalog connectors derive their layer from the registry;
   * custom ones declare it.
   */
  async register(
    projectId: string,
    input: RegisterConnectorInput,
  ): Promise<ConnectorInstanceRecord> {
    let connectorType: string;
    let layer: string;

    if (input.source === "catalog") {
      if (!input.connectorType) {
        throw badRequest("connectorType is required for catalog connectors");
      }
      const def = this.deps.registry.get(input.connectorType);
      if (!def) {
        throw badRequest(`Unknown connector type: ${input.connectorType}`);
      }
      connectorType = def.type;
      layer = def.layer;
    } else {
      if (!input.layer) {
        throw badRequest("layer is required for custom connectors");
      }
      connectorType = CUSTOM_CONNECTOR_TYPE;
      layer = input.layer;
    }

    return this.deps.repo.create({
      projectId,
      connectorType,
      layer,
      name: input.name,
      status: "configured",
      config: input.config ?? {},
    });
  }

  listByProject(projectId: string): Promise<ConnectorInstanceRecord[]> {
    return this.deps.repo.findByProject(projectId);
  }

  getById(instanceId: string): Promise<ConnectorInstanceRecord | null> {
    return this.deps.repo.findById(instanceId);
  }

  async update(
    instanceId: string,
    input: UpdateConnectorInput,
  ): Promise<ConnectorInstanceRecord> {
    const instance = await this.requireInstance(instanceId);

    const patch: UpdateConnectorInstanceData = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.config !== undefined) patch.config = input.config;
    // A catalog connector's layer is fixed by its definition; only custom
    // (user-declared) instances may change layer.
    if (
      input.layer !== undefined &&
      instance.connectorType === CUSTOM_CONNECTOR_TYPE
    ) {
      patch.layer = input.layer;
    }

    return this.deps.repo.update(instanceId, patch);
  }

  async remove(instanceId: string): Promise<void> {
    await this.requireInstance(instanceId);
    if (this.deps.secrets) await this.deps.secrets.delete(instanceId);
    await this.deps.repo.delete(instanceId);
  }

  // ── Configure & connect (credentialed flows) ──────────────────────────────

  /**
   * Verify credentials against the connector and, on success, store them in the
   * SecretStore and mark the instance `connected`. Credentials never touch the
   * instance record.
   */
  async connect(
    instanceId: string,
    rawCredentials: unknown,
  ): Promise<ConnectorInstanceRecord> {
    const instance = await this.requireInstance(instanceId);
    const def = this.requireDef(instance.connectorType);

    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      instance.config,
      "config",
    );
    const credentials = this.parseOrThrow<Record<string, unknown>>(
      def.credentialsSchema,
      rawCredentials,
      "credentials",
    );

    try {
      await def.testConnection(this.buildContext(config, credentials));
    } catch (err) {
      throw badRequest(`Connection test failed: ${(err as Error).message}`);
    }

    await this.secrets().set(instanceId, credentials);
    return this.deps.repo.update(instanceId, { status: "connected" });
  }

  /** Drop the stored credentials and return the instance to `configured`. */
  async disconnect(instanceId: string): Promise<ConnectorInstanceRecord> {
    await this.requireInstance(instanceId);
    await this.secrets().delete(instanceId);
    return this.deps.repo.update(instanceId, { status: "configured" });
  }

  /** Invoke a connector capability — the direct (no-AI) execution path. */
  async invoke(
    instanceId: string,
    capabilityName: string,
    rawInput: unknown,
  ): Promise<{ capability: string; result: unknown }> {
    const instance = await this.requireInstance(instanceId);
    const def = this.requireDef(instance.connectorType);

    const capability = def.capabilities.find((c) => c.name === capabilityName);
    if (!capability) {
      throw notFound(`Unknown capability "${capabilityName}" for ${def.type}`);
    }

    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      instance.config,
      "config",
    );
    const input = this.parseOrThrow(capability.input, rawInput, "input");
    const credentials = (await this.secrets().get(instanceId)) ?? {};
    const result = await capability.handler(
      this.buildContext(config, credentials),
      input,
    );
    return { capability: capability.name, result };
  }

  /**
   * Generic (Tier-2) API call: invoke any catalogued operation — or a raw
   * method+path — against the connected service, reusing its stored credentials.
   * Complements the curated capabilities without a hand-written handler per call.
   */
  async callApi(
    instanceId: string,
    input: CallApiInput,
  ): Promise<RawApiResponse> {
    const instance = await this.requireInstance(instanceId);
    const def = this.requireDef(instance.connectorType);
    const exec = def.api?.request;
    if (!exec) {
      throw badRequest(`Connector "${def.type}" has no callable raw API`);
    }

    const { method, path } = this.resolveOperation(def, input);
    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      instance.config,
      "config",
    );
    const credentials = (await this.secrets().get(instanceId)) ?? {};
    return exec(this.buildContext(config, credentials), {
      method,
      path,
      query: input.query,
      body: input.body,
    });
  }

  /**
   * Multi-turn chat against a model-provider connector (layer "model"). The
   * seam for Orbit's internal chat/agent — distinct from the single-prompt
   * `chat` capability. Reuses the instance's stored credentials.
   */
  async chat(
    instanceId: string,
    input: ModelChatInput,
  ): Promise<ModelChatResult> {
    const instance = await this.requireInstance(instanceId);
    const def = this.requireDef(instance.connectorType);
    if (!def.model) {
      throw badRequest(`Connector "${def.type}" is not a model provider`);
    }
    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      instance.config,
      "config",
    );
    const credentials = (await this.secrets().get(instanceId)) ?? {};
    return def.model.chat(this.buildContext(config, credentials), input);
  }

  /** Streaming chat: yields text deltas. Falls back to a single chunk for
   *  providers without native streaming. */
  async *chatStream(
    instanceId: string,
    input: ModelChatInput,
  ): AsyncGenerator<string> {
    const instance = await this.requireInstance(instanceId);
    const def = this.requireDef(instance.connectorType);
    if (!def.model) {
      throw badRequest(`Connector "${def.type}" is not a model provider`);
    }
    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      instance.config,
      "config",
    );
    const credentials = (await this.secrets().get(instanceId)) ?? {};
    const ctx = this.buildContext(config, credentials);
    if (def.model.chatStream) {
      yield* def.model.chatStream(ctx, input);
    } else {
      const r = await def.model.chat(ctx, input);
      yield r.content;
    }
  }

  /**
   * Tool-using chat (the no-AI→AI bridge): the model may call the project's
   * connected connectors' **read-only** capabilities as tools. The host stays
   * in the loop — execute tool → feed result back → repeat — until a final text
   * answer. Returns the new turns (assistant + tool steps) for the UI to render.
   */
  async chatWithTools(
    modelInstanceId: string,
    input: ModelChatInput,
  ): Promise<{ content: string; messages: ChatMessage[] }> {
    const modelInstance = await this.requireInstance(modelInstanceId);
    const def = this.requireDef(modelInstance.connectorType);
    if (!def.model) {
      throw badRequest(`Connector "${def.type}" is not a model provider`);
    }

    // Gather read-only tools from the project's other connected connectors.
    const projectConnectors = await this.deps.repo.findByProject(
      modelInstance.projectId,
    );
    const tools: ModelTool[] = [];
    const toolMap = new Map<string, { instanceId: string; capability: string }>();
    for (const conn of projectConnectors) {
      if (conn.status !== "connected" || conn.id === modelInstanceId) continue;
      const d = this.deps.registry.get(conn.connectorType);
      if (!d || d.layer === "model") continue;
      for (const t of mcpToolsFromConnector(d)) {
        if (!t.annotations.readOnly || toolMap.has(t.name)) continue;
        tools.push({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        });
        toolMap.set(t.name, {
          instanceId: conn.id,
          capability: t.name.slice(d.type.length + 2),
        });
      }
    }

    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      modelInstance.config,
      "config",
    );
    const credentials = (await this.secrets().get(modelInstanceId)) ?? {};
    const ctx = this.buildContext(config, credentials);

    const convo: ChatMessage[] = [...input.messages];
    const appended: ChatMessage[] = [];
    const MAX_STEPS = 6;

    for (let step = 0; step < MAX_STEPS; step++) {
      let result;
      try {
        result = await def.model.chat(ctx, {
          ...input,
          messages: convo,
          tools: tools.length ? tools : undefined,
        });
      } catch (err) {
        // Some local models don't support tools — degrade to a plain answer.
        if (
          step === 0 &&
          tools.length &&
          /does not support tools|tool/i.test((err as Error).message)
        ) {
          result = await def.model.chat(ctx, { ...input, messages: convo });
        } else {
          throw err;
        }
      }
      const assistant: ChatMessage = {
        role: "assistant",
        content: result.content,
        ...(result.toolCalls?.length ? { toolCalls: result.toolCalls } : {}),
      };
      convo.push(assistant);
      appended.push(assistant);

      if (!result.toolCalls?.length) {
        return { content: result.content, messages: appended };
      }

      for (const call of result.toolCalls) {
        const target = toolMap.get(call.name);
        let resultText: string;
        try {
          if (!target) throw new Error(`Unknown tool: ${call.name}`);
          const out = await this.invoke(
            target.instanceId,
            target.capability,
            call.input,
          );
          resultText = JSON.stringify(out.result);
        } catch (err) {
          resultText = `Error: ${(err as Error).message}`;
        }
        const toolMsg: ChatMessage = {
          role: "tool",
          content: resultText,
          toolCallId: call.id,
          toolName: call.name,
        };
        convo.push(toolMsg);
        appended.push(toolMsg);
      }
    }

    return {
      content: appended[appended.length - 1]?.content ?? "",
      messages: appended,
    };
  }

  /** Gather the project's connectors' capabilities as tools (with read-only
   *  flags) + a map back to the executing connector. Shared by chatTurn/runTool. */
  private async gatherTools(modelInstanceId: string): Promise<{
    modelInstance: ConnectorInstanceRecord;
    tools: (ModelTool & { readOnly: boolean })[];
    toolMap: Map<string, { instanceId: string; capability: string }>;
  }> {
    const modelInstance = await this.requireInstance(modelInstanceId);
    const projectConnectors = await this.deps.repo.findByProject(
      modelInstance.projectId,
    );
    const tools: (ModelTool & { readOnly: boolean })[] = [];
    const toolMap = new Map<
      string,
      { instanceId: string; capability: string }
    >();
    for (const conn of projectConnectors) {
      if (conn.status !== "connected" || conn.id === modelInstanceId) continue;
      const d = this.deps.registry.get(conn.connectorType);
      if (!d || d.layer === "model") continue;
      for (const t of mcpToolsFromConnector(d)) {
        if (toolMap.has(t.name)) continue;
        tools.push({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          readOnly: t.annotations.readOnly,
        });
        toolMap.set(t.name, {
          instanceId: conn.id,
          capability: t.name.slice(d.type.length + 2),
        });
      }
    }
    return { modelInstance, tools, toolMap };
  }

  /**
   * One model turn with the project's tools — the streaming-free primitive for
   * the frontend-driven agentic loop. Returns text + the requested tool calls,
   * each tagged read-only or not so the host can confirm mutating ones.
   */
  async chatTurn(
    modelInstanceId: string,
    input: ModelChatInput,
  ): Promise<{
    content: string;
    toolCalls: (ToolCall & { readOnly: boolean })[];
  }> {
    const { modelInstance, tools } = await this.gatherTools(modelInstanceId);
    const def = this.requireDef(modelInstance.connectorType);
    if (!def.model) {
      throw badRequest(`Connector "${def.type}" is not a model provider`);
    }
    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      modelInstance.config,
      "config",
    );
    const credentials = (await this.secrets().get(modelInstanceId)) ?? {};
    const ctx = this.buildContext(config, credentials);

    const modelTools: ModelTool[] = tools.map(({ readOnly: _ro, ...t }) => t);
    let result: ModelChatResult;
    try {
      result = await def.model.chat(ctx, {
        ...input,
        tools: modelTools.length ? modelTools : undefined,
      });
    } catch (err) {
      // Models that don't support tools degrade to a plain answer.
      if (
        modelTools.length &&
        /does not support tools|tool/i.test((err as Error).message)
      ) {
        result = await def.model.chat(ctx, { ...input });
      } else {
        throw err;
      }
    }
    const readOnlyByName = new Map(tools.map((t) => [t.name, t.readOnly]));
    const toolCalls = (result.toolCalls ?? []).map((tc) => ({
      ...tc,
      readOnly: readOnlyByName.get(tc.name) ?? true,
    }));
    return { content: result.content, toolCalls };
  }

  /** Execute a tool by its (namespaced) name on the right connector. */
  async runTool(
    modelInstanceId: string,
    name: string,
    input: unknown,
  ): Promise<{ result: unknown }> {
    const { toolMap } = await this.gatherTools(modelInstanceId);
    const target = toolMap.get(name);
    if (!target) throw badRequest(`Unknown tool: ${name}`);
    const out = await this.invoke(target.instanceId, target.capability, input);
    return { result: out.result };
  }

  /** Streaming version of {@link chatTurn}: yields text deltas, then returns
   *  the requested tool calls (read-only flagged) for the frontend loop. */
  async *chatTurnStream(
    modelInstanceId: string,
    input: ModelChatInput,
  ): AsyncGenerator<
    string,
    { toolCalls: (ToolCall & { readOnly: boolean })[] },
    void
  > {
    const { modelInstance, tools } = await this.gatherTools(modelInstanceId);
    const def = this.requireDef(modelInstance.connectorType);
    if (!def.model) {
      throw badRequest(`Connector "${def.type}" is not a model provider`);
    }
    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      modelInstance.config,
      "config",
    );
    const credentials = (await this.secrets().get(modelInstanceId)) ?? {};
    const ctx = this.buildContext(config, credentials);

    const modelTools: ModelTool[] = tools.map(({ readOnly: _ro, ...t }) => t);
    const readOnlyByName = new Map(tools.map((t) => [t.name, t.readOnly]));
    const enrich = (calls: ToolCall[]) =>
      calls.map((tc) => ({
        ...tc,
        readOnly: readOnlyByName.get(tc.name) ?? true,
      }));

    if (def.model.chatTurnStream) {
      try {
        const gen = def.model.chatTurnStream(ctx, {
          ...input,
          tools: modelTools.length ? modelTools : undefined,
        });
        let r = await gen.next();
        while (!r.done) {
          yield r.value;
          r = await gen.next();
        }
        return { toolCalls: enrich((r.value || []) as ToolCall[]) };
      } catch (err) {
        // Model doesn't support tools → fall through to a plain stream.
        if (
          !(
            modelTools.length &&
            /does not support tools|tool/i.test((err as Error).message)
          )
        ) {
          throw err;
        }
      }
    }

    // Fallback: plain streaming (or a single chunk) without tools.
    if (def.model.chatStream) {
      yield* def.model.chatStream(ctx, { ...input });
      return { toolCalls: [] };
    }
    const res = await def.model.chat(ctx, { ...input });
    if (res.content) yield res.content;
    return { toolCalls: enrich(res.toolCalls ?? []) };
  }

  /** Resolve a {@link CallApiInput} to a concrete method + path. */
  private resolveOperation(
    def: ConnectorDefinition,
    input: CallApiInput,
  ): { method: HttpMethod; path: string } {
    if (input.operationId) {
      const op = def.api?.operations.find((o) => o.id === input.operationId);
      if (!op) {
        throw notFound(
          `Unknown API operation "${input.operationId}" for ${def.type}`,
        );
      }
      let path = op.path;
      for (const [key, value] of Object.entries(input.pathParams ?? {})) {
        path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
      }
      const missing = path.match(/\{([^}]+)\}/);
      if (missing) {
        throw badRequest(
          `Missing path param "${missing[1]}" for operation ${op.id}`,
        );
      }
      return { method: op.method, path };
    }
    if (input.method && input.path) {
      return { method: input.method, path: input.path };
    }
    throw badRequest("callApi requires either operationId or method + path");
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async requireInstance(
    instanceId: string,
  ): Promise<ConnectorInstanceRecord> {
    const instance = await this.deps.repo.findById(instanceId);
    if (!instance) {
      throw notFound(`Connector instance not found: ${instanceId}`);
    }
    return instance;
  }

  private requireDef(connectorType: string) {
    const def = this.deps.registry.get(connectorType);
    if (!def) {
      throw badRequest(`No live connector available for type: ${connectorType}`);
    }
    return def;
  }

  private secrets(): SecretStore {
    if (!this.deps.secrets) {
      throw new Error("SecretStore is not configured for this host");
    }
    return this.deps.secrets;
  }

  private parseOrThrow<T>(schema: ZodType, value: unknown, label: string): T {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw badRequest(`Invalid ${label}`);
    }
    return result.data as T;
  }

  private buildContext(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
  ): ConnectorContext {
    return {
      config,
      credentials,
      fetch: this.deps.fetch ?? globalThis.fetch,
      logger: this.deps.logger ?? noopLogger,
    };
  }
}
