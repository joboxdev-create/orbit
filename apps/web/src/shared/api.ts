import { auth } from "@/shared/auth";

export const CORE_API_URL =
  process.env.CORE_API_URL ?? "http://localhost:3001/api";

export interface ConnectorSummary {
  type: string;
  layer: string;
  displayName: string;
  description: string;
  icon: string | null;
  capabilities: number;
  apiOperations: number;
}

export interface MeResponse {
  id: string;
  email: string;
  name?: string | null;
  provider: string;
  platformRole: string;
  createdAt: string;
}

export interface OrbitUser {
  id: string;
  email: string;
  name?: string | null;
  provider: string;
  platformRole: string;
  createdAt: string;
}

async function coreFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await auth();
  const headers = new Headers(init?.headers);
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  return fetch(`${CORE_API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

// ─── Connectors ──────────────────────────────────────────────────────────────

export async function getConnectors(): Promise<ConnectorSummary[]> {
  try {
    const res = await coreFetch("/connectors");
    if (!res.ok) return [];
    return (await res.json()) as ConnectorSummary[];
  } catch {
    return [];
  }
}

// ─── Auth / Me ───────────────────────────────────────────────────────────────

export async function getMe(): Promise<MeResponse | null> {
  try {
    const res = await coreFetch("/auth/me");
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

// ─── Users (admin) ───────────────────────────────────────────────────────────

export async function listUsers(): Promise<OrbitUser[]> {
  try {
    const res = await coreFetch("/auth/users");
    if (!res.ok) return [];
    return (await res.json()) as OrbitUser[];
  } catch {
    return [];
  }
}

export async function getUserById(id: string): Promise<OrbitUser | null> {
  try {
    const res = await coreFetch(`/auth/users/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as OrbitUser;
  } catch {
    return null;
  }
}

// ─── Mutation helpers ─────────────────────────────────────────────────────────

/** Shape returned by write operations. */
export type MutationResult = { ok: true } | { ok: false; error: string };

async function postJson(
  path: string,
  payload: unknown,
): Promise<MutationResult> {
  try {
    const res = await coreFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    return {
      ok: false,
      error: body?.message ?? `Request failed (${res.status})`,
    };
  } catch {
    return { ok: false, error: "Could not reach the core API." };
  }
}

async function patchJson(
  path: string,
  payload: unknown,
): Promise<MutationResult> {
  try {
    const res = await coreFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    return {
      ok: false,
      error: body?.message ?? `Request failed (${res.status})`,
    };
  } catch {
    return { ok: false, error: "Could not reach the core API." };
  }
}

async function deleteReq(path: string): Promise<MutationResult> {
  try {
    const res = await coreFetch(path, { method: "DELETE" });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    return {
      ok: false,
      error: body?.message ?? `Request failed (${res.status})`,
    };
  } catch {
    return { ok: false, error: "Could not reach the core API." };
  }
}

// ─── Organizations ────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export async function getOrganizations(): Promise<Organization[]> {
  try {
    const res = await coreFetch("/organizations");
    if (!res.ok) return [];
    return (await res.json()) as Organization[];
  } catch {
    return [];
  }
}

export async function getOrganization(
  id: string,
): Promise<Organization | null> {
  try {
    const res = await coreFetch(`/organizations/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as Organization;
  } catch {
    return null;
  }
}

export async function createOrganization(input: {
  name: string;
  slug: string;
}): Promise<MutationResult> {
  return postJson("/organizations", input);
}

export async function updateOrganization(
  id: string,
  input: { name?: string; slug?: string },
): Promise<MutationResult> {
  return patchJson(`/organizations/${id}`, input);
}

export async function deleteOrganization(id: string): Promise<MutationResult> {
  return deleteReq(`/organizations/${id}`);
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
}

export async function getProjects(orgId: string): Promise<Project[]> {
  try {
    const res = await coreFetch(`/projects?orgId=${encodeURIComponent(orgId)}`);
    if (!res.ok) return [];
    return (await res.json()) as Project[];
  } catch {
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const res = await coreFetch(`/projects/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as Project;
  } catch {
    return null;
  }
}

export async function createProject(input: {
  orgId: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<MutationResult> {
  return postJson("/projects", input);
}

export async function updateProject(
  id: string,
  input: { name?: string; slug?: string; description?: string },
): Promise<MutationResult> {
  return patchJson(`/projects/${id}`, input);
}

export async function deleteProject(id: string): Promise<MutationResult> {
  return deleteReq(`/projects/${id}`);
}

// ─── User mutations (admin) ───────────────────────────────────────────────────

export async function updateUser(
  id: string,
  input: {
    name?: string;
    email?: string;
    platformRole?: string;
    password?: string;
  },
): Promise<MutationResult> {
  return patchJson(`/auth/users/${id}`, input);
}

export async function deleteUser(id: string): Promise<MutationResult> {
  return deleteReq(`/auth/users/${id}`);
}

// ─── Connector instances ──────────────────────────────────────────────────────

export interface ConnectorInstance {
  id: string;
  projectId: string;
  connectorType: string;
  layer: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export async function getConnectorInstances(
  projectId: string,
): Promise<ConnectorInstance[]> {
  try {
    const res = await coreFetch(`/projects/${projectId}/connectors`);
    if (!res.ok) return [];
    return (await res.json()) as ConnectorInstance[];
  } catch {
    return [];
  }
}

/** Sentinel connectorType for user-declared services without a code connector. */
export const CUSTOM_CONNECTOR_TYPE = "custom";

/**
 * Register a connector in a project (the "catalogue it" step). Credentials,
 * testConnection and capability invocation are a separate, later step.
 */
export async function registerConnector(
  projectId: string,
  input: {
    source: "catalog" | "custom";
    name: string;
    connectorType?: string;
    layer?: string;
    config?: Record<string, unknown>;
  },
): Promise<MutationResult> {
  return postJson(`/projects/${projectId}/connectors/register`, input);
}

export async function updateConnectorInstance(
  id: string,
  input: { name?: string; layer?: string; config?: Record<string, unknown> },
): Promise<MutationResult> {
  return patchJson(`/connector-instances/${id}`, input);
}

export async function deleteConnectorInstance(
  id: string,
): Promise<MutationResult> {
  return deleteReq(`/connector-instances/${id}`);
}
