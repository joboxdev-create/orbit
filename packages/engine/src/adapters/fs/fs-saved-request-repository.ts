import { randomUUID } from "node:crypto";
import type {
  CreateSavedRequestData,
  SavedRequest,
  SavedRequestRepository,
} from "../../domain/saved-request.js";
import { notFound } from "../../errors.js";
import { FileWorkspace } from "./file-workspace.js";

/**
 * Filesystem-backed SavedRequestRepository for the desktop host. Saved requests
 * live under their project's `.orbit/requests/<id>.json` — workspace data, no
 * secrets, sync-friendly like the rest of `.orbit/`.
 */
export class FsSavedRequestRepository implements SavedRequestRepository {
  private readonly ws: FileWorkspace;

  constructor(workspaceRoot: string | FileWorkspace) {
    this.ws =
      typeof workspaceRoot === "string"
        ? new FileWorkspace(workspaceRoot)
        : workspaceRoot;
  }

  async create(data: CreateSavedRequestData): Promise<SavedRequest> {
    const instance = await this.ws.findConnector(data.instanceId);
    if (!instance) {
      throw notFound(`Connector instance not found: ${data.instanceId}`);
    }
    const record: SavedRequest = {
      id: randomUUID(),
      projectId: instance.record.projectId,
      instanceId: data.instanceId,
      name: data.name,
      topic: data.topic ?? "saved",
      ...(data.operationId !== undefined && { operationId: data.operationId }),
      ...(data.method !== undefined && { method: data.method }),
      ...(data.path !== undefined && { path: data.path }),
      ...(data.pathParams !== undefined && { pathParams: data.pathParams }),
      ...(data.query !== undefined && { query: data.query }),
      ...(data.body !== undefined && { body: data.body }),
      createdAt: new Date().toISOString(),
    };
    await this.ws.writeRequest(instance.projectDir, record);
    return record;
  }

  async listByInstance(instanceId: string): Promise<SavedRequest[]> {
    const instance = await this.ws.findConnector(instanceId);
    if (!instance) return [];
    const all = await this.ws.listRequests(instance.projectDir);
    return all
      .filter((r) => r.instanceId === instanceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string): Promise<void> {
    const found = await this.ws.findRequest(id);
    if (found) await this.ws.removeRequestFile(found.path);
  }
}
