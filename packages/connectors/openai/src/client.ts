import type {
  ConnectorContext,
  RawApiRequest,
  RawApiResponse,
} from "@orbit/connector-sdk";

export type OpenAiConfig = {
  baseUrl: string;
};

export type OpenAiCredentials = {
  apiKey: string;
};

function openAiHeaders(
  credentials: OpenAiCredentials,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (credentials.apiKey) {
    headers.Authorization = `Bearer ${credentials.apiKey}`;
  }
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function openAiRequest<T>(
  ctx: ConnectorContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const config = ctx.config as OpenAiConfig;
  const url = `${config.baseUrl.replace(/\/$/, "")}${path}`;
  const res = await ctx.fetch(url, {
    method,
    headers: openAiHeaders(ctx.credentials as OpenAiCredentials, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenAI API ${res.status} ${res.statusText} for ${path}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function openAiGet<T>(ctx: ConnectorContext, path: string): Promise<T> {
  return openAiRequest<T>(ctx, "GET", path);
}

export function openAiPost<T>(
  ctx: ConnectorContext,
  path: string,
  body: unknown,
): Promise<T> {
  return openAiRequest<T>(ctx, "POST", path, body);
}

/** POST that returns the raw response body stream (for streaming endpoints). */
export async function openAiFetchStream(
  ctx: ConnectorContext,
  path: string,
  body: unknown,
): Promise<ReadableStream<Uint8Array>> {
  const config = ctx.config as OpenAiConfig;
  const res = await ctx.fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: openAiHeaders(ctx.credentials as OpenAiCredentials, true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenAI API ${res.status} ${res.statusText} for ${path}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`,
    );
  }
  if (!res.body) throw new Error("OpenAI API: empty response body");
  return res.body as ReadableStream<Uint8Array>;
}

/** Yield newline-delimited lines from a byte stream (SSE). */
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
export async function openAiRawRequest(
  ctx: ConnectorContext,
  req: RawApiRequest,
): Promise<RawApiResponse> {
  const config = ctx.config as OpenAiConfig;
  const url = new URL(`${config.baseUrl.replace(/\/$/, "")}${req.path}`);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await ctx.fetch(url.toString(), {
    method: req.method,
    headers: openAiHeaders(
      ctx.credentials as OpenAiCredentials,
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
    const snippet = typeof data === "string" ? data : JSON.stringify(data ?? "");
    throw new Error(
      `OpenAI API ${res.status} ${res.statusText} for ${req.method} ${req.path}${
        snippet ? `: ${snippet.slice(0, 200)}` : ""
      }`,
    );
  }
  return { status: res.status, data };
}
