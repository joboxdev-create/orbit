import type {
  ConnectorContext,
  RawApiRequest,
  RawApiResponse,
} from "@orbit/connector-sdk";

// Type aliases (not interfaces) so they stay assignable to the SDK's
// Record<string, unknown> context without an explicit index signature.
export type OllamaConfig = {
  baseUrl: string;
};

export type OllamaCredentials = {
  /** Optional bearer token — local Ollama is keyless; some proxies add auth. */
  apiKey?: string;
};

function ollamaHeaders(
  credentials: OllamaCredentials,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  if (credentials.apiKey) headers.Authorization = `Bearer ${credentials.apiKey}`;
  return headers;
}

async function ollamaRequest<T>(
  ctx: ConnectorContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const config = ctx.config as OllamaConfig;
  const url = `${config.baseUrl.replace(/\/$/, "")}${path}`;
  const res = await ctx.fetch(url, {
    method,
    headers: ollamaHeaders(
      ctx.credentials as OllamaCredentials,
      body !== undefined,
    ),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama API ${res.status} ${res.statusText} for ${path}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function ollamaGet<T>(ctx: ConnectorContext, path: string): Promise<T> {
  return ollamaRequest<T>(ctx, "GET", path);
}

export function ollamaPost<T>(
  ctx: ConnectorContext,
  path: string,
  body: unknown,
): Promise<T> {
  return ollamaRequest<T>(ctx, "POST", path, body);
}

/** POST that returns the raw response body stream (for streaming endpoints). */
export async function ollamaFetchStream(
  ctx: ConnectorContext,
  path: string,
  body: unknown,
): Promise<ReadableStream<Uint8Array>> {
  const config = ctx.config as OllamaConfig;
  const res = await ctx.fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: ollamaHeaders(ctx.credentials as OllamaCredentials, true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama API ${res.status} ${res.statusText} for ${path}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`,
    );
  }
  if (!res.body) throw new Error("Ollama API: empty response body");
  return res.body as ReadableStream<Uint8Array>;
}

/** Yield newline-delimited lines from a byte stream (NDJSON / SSE). */
export async function* readLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      yield buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer) yield buffer;
}

/** Generic (Tier-2) raw request: the connector's `api.request` executor. */
export async function ollamaRawRequest(
  ctx: ConnectorContext,
  req: RawApiRequest,
): Promise<RawApiResponse> {
  const config = ctx.config as OllamaConfig;
  const url = new URL(`${config.baseUrl.replace(/\/$/, "")}${req.path}`);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await ctx.fetch(url.toString(), {
    method: req.method,
    headers: ollamaHeaders(
      ctx.credentials as OllamaCredentials,
      req.body !== undefined,
    ),
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text || undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* leave as raw text */
    }
  }
  if (!res.ok) {
    const snippet =
      typeof data === "string" ? data : JSON.stringify(data ?? "");
    throw new Error(
      `Ollama API ${res.status} ${res.statusText} for ${req.method} ${req.path}${
        snippet ? `: ${snippet.slice(0, 200)}` : ""
      }`,
    );
  }
  return { status: res.status, data };
}
