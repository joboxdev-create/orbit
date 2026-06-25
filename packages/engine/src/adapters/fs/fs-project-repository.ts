import { randomUUID } from "node:crypto";
import type {
  CreateProjectData,
  ProjectListFilter,
  ProjectRecord,
  ProjectRepository,
} from "../../domain/project.js";
import { conflict, notFound } from "../../errors.js";
import { FileWorkspace } from "./file-workspace.js";

/**
 * Filesystem-backed ProjectRepository for the desktop host. The project folder
 * (named by slug) is the source of truth — no database. Local projects have no
 * organization, so `orgId` is null.
 */
export class FsProjectRepository implements ProjectRepository {
  private readonly ws: FileWorkspace;

  constructor(workspaceRoot: string | FileWorkspace) {
    this.ws =
      typeof workspaceRoot === "string"
        ? new FileWorkspace(workspaceRoot)
        : workspaceRoot;
  }

  async create(data: CreateProjectData): Promise<ProjectRecord> {
    const dir = this.ws.projectDirForSlug(data.slug);
    if (await this.ws.readProject(dir)) {
      throw conflict(`A project with slug "${data.slug}" already exists`);
    }
    const record: ProjectRecord = {
      id: randomUUID(),
      orgId: data.orgId ?? null,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.ws.writeProject(dir, record);
    return record;
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    return (await this.ws.findProjectById(id))?.record ?? null;
  }

  async list(filter?: ProjectListFilter): Promise<ProjectRecord[]> {
    const records = (await this.ws.listProjects()).map((p) => p.record);
    const filtered = filter?.orgId
      ? records.filter((r) => r.orgId === filter.orgId)
      : records;
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async update(
    id: string,
    patch: { name?: string; slug?: string; description?: string | null },
  ): Promise<ProjectRecord> {
    const found = await this.ws.findProjectById(id);
    if (!found) throw notFound(`Project not found: ${id}`);

    const updated: ProjectRecord = {
      ...found.record,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.slug !== undefined && { slug: patch.slug }),
      ...(patch.description !== undefined && {
        description: patch.description,
      }),
    };

    // A slug change renames the folder (the folder name is the slug).
    if (patch.slug !== undefined && patch.slug !== found.record.slug) {
      const newDir = this.ws.projectDirForSlug(patch.slug);
      if (await this.ws.readProject(newDir)) {
        throw conflict(`A project with slug "${patch.slug}" already exists`);
      }
      await this.ws.renameProjectDir(found.dir, newDir);
      await this.ws.writeProject(newDir, updated);
    } else {
      await this.ws.writeProject(found.dir, updated);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const found = await this.ws.findProjectById(id);
    if (!found) throw notFound(`Project not found: ${id}`);
    await this.ws.removeProjectDir(found.dir);
  }
}
