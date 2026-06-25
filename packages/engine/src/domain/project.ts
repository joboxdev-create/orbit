// Project — the central, host-neutral domain entity. On the desktop a project
// lives as a folder with an `.orbit/` manifest (file store, single-user, no
// orgs); on the server it is a row scoped to an organization. The engine talks
// to projects only through the ProjectRepository port, so the same domain logic
// runs over either backing store.

export interface ProjectRecord {
  id: string;
  /**
   * Server-side grouping (the owning organization). `null` on the desktop,
   * where a project is just a folder with no organization/governance.
   */
  orgId: string | null;
  name: string;
  slug: string;
  description: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface CreateProjectData {
  orgId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
}

export interface UpdateProjectData {
  name?: string;
  slug?: string;
  description?: string | null;
}

/** Optional, host-neutral filter for listing projects. */
export interface ProjectListFilter {
  /** Server adapter filters by organization; the desktop ignores it. */
  orgId?: string;
}

/**
 * Persistence port for projects. Implemented by a filesystem adapter (desktop)
 * and a Prisma/Postgres adapter (server). Governance (RBAC, membership) is NOT
 * here — it is a server-only layer above this port.
 */
export interface ProjectRepository {
  create(data: CreateProjectData): Promise<ProjectRecord>;
  findById(id: string): Promise<ProjectRecord | null>;
  list(filter?: ProjectListFilter): Promise<ProjectRecord[]>;
  update(id: string, patch: UpdateProjectData): Promise<ProjectRecord>;
  delete(id: string): Promise<void>;
}
