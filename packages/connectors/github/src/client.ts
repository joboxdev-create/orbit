import type { ConnectorContext } from "@orbit/connector-sdk";

// Type aliases (not interfaces) so they stay assignable to the SDK's
// Record<string, unknown> context without an explicit index signature.
export type GithubConfig = {
  baseUrl: string;
};

export type GithubCredentials = {
  /** Optional PAT. Without it, only public, rate-limited reads work. */
  token?: string;
};

/** Perform an authenticated (or anonymous) GET against the GitHub REST API. */
export async function ghGet<T>(
  ctx: ConnectorContext,
  path: string,
): Promise<T> {
  const config = ctx.config as GithubConfig;
  const credentials = ctx.credentials as GithubCredentials;
  const url = `${config.baseUrl.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    // GitHub rejects requests without a User-Agent.
    "User-Agent": "orbit-connector-github",
  };
  if (credentials.token) {
    headers.Authorization = `Bearer ${credentials.token}`;
  }

  const res = await ctx.fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub API ${res.status} ${res.statusText} for ${path}${
        body ? `: ${body.slice(0, 200)}` : ""
      }`,
    );
  }
  return (await res.json()) as T;
}
