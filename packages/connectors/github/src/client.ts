import type {
  ConnectorContext,
  RawApiRequest,
  RawApiResponse,
} from "@orbit/connector-sdk";

// Type aliases (not interfaces) so they stay assignable to the SDK's
// Record<string, unknown> context without an explicit index signature.
export type GithubConfig = {
  baseUrl: string;
};

export type GithubCredentials = {
  /** Optional PAT. Without it, only public, rate-limited reads work. */
  token?: string;
};

/** Standard GitHub REST headers; adds auth and content-type when relevant. */
function ghHeaders(
  credentials: GithubCredentials,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    // GitHub rejects requests without a User-Agent.
    "User-Agent": "orbit-connector-github",
  };
  if (credentials.token) headers.Authorization = `Bearer ${credentials.token}`;
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

/** Authenticated (or anonymous) request against the GitHub REST API. */
async function ghRequest<T>(
  ctx: ConnectorContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const config = ctx.config as GithubConfig;
  const url = `${config.baseUrl.replace(/\/$/, "")}${path}`;

  const res = await ctx.fetch(url, {
    method,
    headers: ghHeaders(ctx.credentials as GithubCredentials, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GitHub API ${res.status} ${res.statusText} for ${path}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function ghGet<T>(ctx: ConnectorContext, path: string): Promise<T> {
  return ghRequest<T>(ctx, "GET", path);
}

export function ghPost<T>(
  ctx: ConnectorContext,
  path: string,
  body: unknown,
): Promise<T> {
  return ghRequest<T>(ctx, "POST", path, body);
}

/**
 * Generic (Tier-2) raw request: any method/path against the API, with explicit
 * query, returning status + parsed body. The connector's `api.request` executor.
 */
export async function ghRawRequest(
  ctx: ConnectorContext,
  req: RawApiRequest,
): Promise<RawApiResponse> {
  const config = ctx.config as GithubConfig;
  const url = new URL(`${config.baseUrl.replace(/\/$/, "")}${req.path}`);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await ctx.fetch(url.toString(), {
    method: req.method,
    headers: ghHeaders(
      ctx.credentials as GithubCredentials,
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
      `GitHub API ${res.status} ${res.statusText} for ${req.method} ${req.path}${
        snippet ? `: ${snippet.slice(0, 200)}` : ""
      }`,
    );
  }
  return { status: res.status, data };
}
