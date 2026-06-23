import type { Capability, ConnectorDefinition } from "@orbit/connector-sdk";
import { z } from "zod";
import {
  kcAdminGet,
  type KeycloakConfig,
  type KeycloakCredentials,
} from "./client.js";

const configSchema = z.object({
  baseUrl: z.string().url(),
  realm: z.string().min(1),
});

const credentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

// --- raw API shapes (only the fields we surface) ---
interface KcRealm {
  realm: string;
  enabled: boolean;
  displayName?: string;
}

interface KcClient {
  id: string;
  clientId: string;
  enabled: boolean;
  publicClient: boolean;
  protocol?: string;
}

interface KcUser {
  id: string;
  username: string;
  email?: string;
  enabled: boolean;
  emailVerified?: boolean;
}

const realmPath = (ctx: { config: unknown }) =>
  encodeURIComponent((ctx.config as KeycloakConfig).realm);

const getRealm: Capability = {
  name: "get_realm",
  title: "Get the configured realm",
  description: "Fetch the settings of the realm this instance manages.",
  topic: "realms",
  readOnly: true,
  input: z.object({}),
  handler: async (ctx) => {
    const r = await kcAdminGet<KcRealm>(ctx, `/realms/${realmPath(ctx)}`);
    return { realm: r.realm, enabled: r.enabled, displayName: r.displayName };
  },
};

const listClients: Capability = {
  name: "list_clients",
  title: "List clients",
  description: "List OIDC/SAML clients registered in the realm.",
  topic: "clients",
  readOnly: true,
  input: z.object({}),
  handler: async (ctx) => {
    const clients = await kcAdminGet<KcClient[]>(
      ctx,
      `/realms/${realmPath(ctx)}/clients`,
    );
    return clients.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      enabled: c.enabled,
      publicClient: c.publicClient,
      protocol: c.protocol ?? null,
    }));
  },
};

const listUsers: Capability = {
  name: "list_users",
  title: "List users",
  description: "List users in the realm (paginated).",
  topic: "users",
  readOnly: true,
  input: z.object({
    search: z.string().optional(),
    max: z.number().int().min(1).max(100).default(20),
  }),
  handler: async (ctx, input) => {
    const { search, max } = input as { search?: string; max: number };
    const params = new URLSearchParams({ max: String(max) });
    if (search) params.set("search", search);
    const users = await kcAdminGet<KcUser[]>(
      ctx,
      `/realms/${realmPath(ctx)}/users?${params.toString()}`,
    );
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email ?? null,
      enabled: u.enabled,
      emailVerified: u.emailVerified ?? false,
    }));
  },
};

export const keycloakConnector: ConnectorDefinition<
  KeycloakConfig,
  KeycloakCredentials
> = {
  type: "keycloak",
  layer: "identity",
  displayName: "Keycloak",
  description: "Realms, clients and users on a Keycloak identity server.",
  icon: "keycloak",
  configSchema,
  credentialsSchema,
  capabilities: [getRealm, listClients, listUsers],
  api: {
    baseUrl: "{baseUrl}/admin",
    operations: [
      {
        id: "realm.get",
        topic: "realms",
        method: "GET",
        path: "/realms/{realm}",
        summary: "Get realm settings",
        docsUrl:
          "https://www.keycloak.org/docs-api/latest/rest-api/index.html#_get_adminrealmsrealm",
      },
      {
        id: "clients.list",
        topic: "clients",
        method: "GET",
        path: "/realms/{realm}/clients",
        summary: "List clients",
        docsUrl:
          "https://www.keycloak.org/docs-api/latest/rest-api/index.html#_get_adminrealmsrealmclients",
      },
      {
        id: "users.list",
        topic: "users",
        method: "GET",
        path: "/realms/{realm}/users",
        summary: "List users",
        docsUrl:
          "https://www.keycloak.org/docs-api/latest/rest-api/index.html#_get_adminrealmsrealmusers",
      },
    ],
  },
  testConnection: async (ctx) => {
    // Cheap authenticated reachability + permissions check on the realm.
    await kcAdminGet(ctx, `/realms/${encodeURIComponent(ctx.config.realm)}`);
  },
};

export default keycloakConnector;
