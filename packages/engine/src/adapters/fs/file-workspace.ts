import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import type { Dirent } from "node:fs";
import { dirname, join } from "node:path";
import type { ProjectRecord } from "../../domain/project.js";
import type { ConnectorInstanceRecord } from "../../domain/connector-instance.js";

const ORBIT_DIR = ".orbit";
const PROJECT_MANIFEST = "project.json";
const CONNECTORS_DIR = "connectors";

function isEnoent(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * Filesystem layout of an Orbit workspace (the desktop's store, no DB):
 *
 *   <root>/<project-slug>/.orbit/project.json          ← project manifest
 *   <root>/<project-slug>/.orbit/connectors/<id>.json  ← connector instances
 *
 * The folder is the source of truth, git-style. This class resolves paths and
 * reads/writes the JSON records; the repository adapters sit on top of it.
 */
export class FileWorkspace {
  constructor(readonly root: string) {}

  projectDirForSlug(slug: string): string {
    return join(this.root, slug);
  }

  private manifestPath(projectDir: string): string {
    return join(projectDir, ORBIT_DIR, PROJECT_MANIFEST);
  }

  private connectorsDir(projectDir: string): string {
    return join(projectDir, ORBIT_DIR, CONNECTORS_DIR);
  }

  private connectorPath(projectDir: string, instanceId: string): string {
    return join(this.connectorsDir(projectDir), `${instanceId}.json`);
  }

  // ── Projects ────────────────────────────────────────────────────────────

  async readProject(projectDir: string): Promise<ProjectRecord | null> {
    return readJson<ProjectRecord>(this.manifestPath(projectDir));
  }

  async writeProject(
    projectDir: string,
    record: ProjectRecord,
  ): Promise<void> {
    await writeJson(this.manifestPath(projectDir), record);
  }

  async renameProjectDir(oldDir: string, newDir: string): Promise<void> {
    await rename(oldDir, newDir);
  }

  async removeProjectDir(projectDir: string): Promise<void> {
    await rm(projectDir, { recursive: true, force: true });
  }

  /** Every project folder (one with a readable `.orbit/project.json`). */
  async listProjects(): Promise<{ dir: string; record: ProjectRecord }[]> {
    let entries: Dirent<string>[];
    try {
      entries = await readdir(this.root, { withFileTypes: true });
    } catch (err) {
      if (isEnoent(err)) return [];
      throw err;
    }
    const out: { dir: string; record: ProjectRecord }[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(this.root, entry.name);
      const record = await this.readProject(dir);
      if (record) out.push({ dir, record });
    }
    return out;
  }

  async findProjectById(
    id: string,
  ): Promise<{ dir: string; record: ProjectRecord } | null> {
    const all = await this.listProjects();
    return all.find((p) => p.record.id === id) ?? null;
  }

  // ── Connector instances ─────────────────────────────────────────────────

  async listConnectors(
    projectDir: string,
  ): Promise<ConnectorInstanceRecord[]> {
    const dir = this.connectorsDir(projectDir);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch (err) {
      if (isEnoent(err)) return [];
      throw err;
    }
    const out: ConnectorInstanceRecord[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const record = await readJson<ConnectorInstanceRecord>(join(dir, file));
      if (record) out.push(record);
    }
    return out;
  }

  async writeConnector(
    projectDir: string,
    record: ConnectorInstanceRecord,
  ): Promise<void> {
    await writeJson(this.connectorPath(projectDir, record.id), record);
  }

  /** Locate a connector across every project (it is keyed only by its id). */
  async findConnector(instanceId: string): Promise<{
    projectDir: string;
    path: string;
    record: ConnectorInstanceRecord;
  } | null> {
    for (const { dir } of await this.listProjects()) {
      const path = this.connectorPath(dir, instanceId);
      const record = await readJson<ConnectorInstanceRecord>(path);
      if (record) return { projectDir: dir, path, record };
    }
    return null;
  }

  async removeConnectorFile(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}
