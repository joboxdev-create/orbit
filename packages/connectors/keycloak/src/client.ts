import type { ConnectorContext } from "@orbit/connector-sdk";

// Type aliases (not interfaces) so they stay assignable to the SDK's
// Record<string, unknown> context without an explicit index signature.
export type KeycloakConfig = {
  /** Base URL of the Keycloak server, e.g. "http://localhost:8080". */
  baseUrl: string;
  /** Realm to manage and to authenticate the service account against. */
  realm: string;
};

export type KeycloakCredentials = {
  /** Confidential client with a service account and realm-management roles. */
  clientId: string;
  clientSecret: string;
};

const trim = (s: string) => s.replace(/\/$/, "");

/**
 * Obtain an admin access token via the client_credentials grant of the
 * connector's service-account client. Kept per-call simple (no caching): the
 * no-AI invocation path is request-scoped and low-frequency.
 */
async function getAdminToken(ctx: ConnectorContext): Promise<string> {
  const config = ctx.config as KeycloakConfig;
  const credentials = ctx.credentials as KeycloakCredentials;
  const url = `${trim(config.baseUrl)}/realms/${encodeURIComponent(
    config.realm,
  )}/protocol/openid-connect/token`;

  const res = await ctx.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Keycloak token request failed (${res.status} ${res.statusText})${
        body ? `: ${body.slice(0, 200)}` : ""
      }`,
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Keycloak token response missing access_token");
  }
  return json.access_token;
}

/** Authenticated GET against the Keycloak Admin REST API (`/admin/...`). */
export async function kcAdminGet<T>(
  ctx: ConnectorContext,
  path: string,
): Promise<T> {
  const config = ctx.config as KeycloakConfig;
  const token = await getAdminToken(ctx);
  const url = `${trim(config.baseUrl)}/admin${path}`;

  const res = await ctx.fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Keycloak Admin API ${res.status} ${res.statusText} for ${path}${
        body ? `: ${body.slice(0, 200)}` : ""
      }`,
    );
  }
  return (await res.json()) as T;
}
