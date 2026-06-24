import { auth } from "@/shared/auth";

/** Base URL of the ORBIT core API. Configured via env, never hardcoded. */
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

/**
 * Fetch against the core, forwarding the signed-in user's ORBIT access token as
 * a Bearer when available. Server-side only (reads the session).
 */
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

/** Fetch registered connectors from the core; tolerate the core being down. */
export async function getConnectors(): Promise<ConnectorSummary[]> {
  try {
    const res = await coreFetch("/connectors");
    if (!res.ok) return [];
    return (await res.json()) as ConnectorSummary[];
  } catch {
    return [];
  }
}

/** Resolve the current user from the core mirror; null if unauthenticated. */
export async function getMe(): Promise<MeResponse | null> {
  try {
    const res = await coreFetch("/auth/me");
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/** Organizations the signed-in user belongs to; empty if unauthenticated. */
export async function getOrganizations(): Promise<Organization[]> {
  try {
    const res = await coreFetch("/organizations");
    if (!res.ok) return [];
    return (await res.json()) as Organization[];
  } catch {
    return [];
  }
}

/** Single organization by id; null if missing or unauthorized. */
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

/** Shape returned by a write that may fail with a server-provided message. */
export type MutationResult = { ok: true } | { ok: false; error: string };

/** Issue a JSON POST to the core and normalize success/error into a result. */
async function postJson(path: string, payload: unknown): Promise<MutationResult> {
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

/** Create an organization for the signed-in user. */
export async function createOrganization(input: {
  name: string;
  slug: string;
}): Promise<MutationResult> {
  return postJson("/organizations", input);
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
}

/** Projects in an organization; empty on error. */
export async function getProjects(orgId: string): Promise<Project[]> {
  try {
    const res = await coreFetch(`/projects?orgId=${encodeURIComponent(orgId)}`);
    if (!res.ok) return [];
    return (await res.json()) as Project[];
  } catch {
    return [];
  }
}

/** Single project by id; null if missing or unauthorized. */
export async function getProject(id: string): Promise<Project | null> {
  try {
    const res = await coreFetch(`/projects/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as Project;
  } catch {
    return null;
  }
}

/** Create a project under an organization. */
export async function createProject(input: {
  orgId: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<MutationResult> {
  return postJson("/projects", input);
}

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

/** Connector instances configured on a project; empty on error. */
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
