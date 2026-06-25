// Client for the local engine sidecar (the desktop's filesystem-backed host).
const BASE = import.meta.env.VITE_SIDECAR_URL ?? "http://127.0.0.1:4317";

export interface Project {
  id: string;
  orgId: string | null;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
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

export interface CatalogEntry {
  type: string;
  layer: string;
  displayName: string;
  description: string;
  icon: string | null;
  capabilities: number;
  apiOperations: number;
}

export interface RegisterConnectorInput {
  source: "catalog" | "custom";
  name: string;
  connectorType?: string;
  layer?: string;
  config?: Record<string, unknown>;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => req<{ ok: boolean; workspace: string }>("/health"),
  listProjects: () => req<Project[]>("/projects"),
  createProject: (input: { name: string; slug: string; description?: string }) =>
    req<Project>("/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (
    id: string,
    input: { name?: string; slug?: string; description?: string },
  ) =>
    req<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string) =>
    req<void>(`/projects/${id}`, { method: "DELETE" }),
  catalog: () => req<CatalogEntry[]>("/connectors/catalog"),
  listConnectors: (projectId: string) =>
    req<ConnectorInstance[]>(`/projects/${projectId}/connectors`),
  registerConnector: (projectId: string, input: RegisterConnectorInput) =>
    req<ConnectorInstance>(`/projects/${projectId}/connectors`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateConnector: (
    id: string,
    input: { name?: string; layer?: string; config?: Record<string, unknown> },
  ) =>
    req<ConnectorInstance>(`/connectors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteConnector: (id: string) =>
    req<void>(`/connectors/${id}`, { method: "DELETE" }),
};
