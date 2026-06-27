import { randomUUID } from "node:crypto";
import type {
  CreateMcpServerData,
  McpServer,
  McpServerRepository,
  UpdateMcpServerData,
} from "../../domain/mcp-server.js";
import { notFound } from "../../errors.js";
import { FileWorkspace } from "./file-workspace.js";

/**
 * Filesystem-backed McpServerRepository for the desktop host. MCP tool sources
 * live under their project's `.orbit/mcp-servers/<id>.json` (no secrets — secret
 * env vars go in the SecretStore, like connector credentials).
 */
export class FsMcpServerRepository implements McpServerRepository {
  private readonly ws: FileWorkspace;

  constructor(workspaceRoot: string | FileWorkspace) {
    this.ws =
      typeof workspaceRoot === "string"
        ? new FileWorkspace(workspaceRoot)
        : workspaceRoot;
  }

  async create(data: CreateMcpServerData): Promise<McpServer> {
    const project = await this.ws.findProjectById(data.projectId);
    if (!project) throw notFound(`Project not found: ${data.projectId}`);
    const now = new Date().toISOString();
    const record: McpServer = {
      id: randomUUID(),
      projectId: data.projectId,
      connectorInstanceId: data.connectorInstanceId,
      name: data.name,
      transport: data.transport ?? "stdio",
      command: data.command ?? "",
      args: data.args ?? [],
      env: data.env ?? {},
      ...(data.url !== undefined && { url: data.url }),
      ...(data.headers !== undefined && { headers: data.headers }),
      status: "configured",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.ws.writeMcpServer(project.dir, record);
    return record;
  }

  async findById(id: string): Promise<McpServer | null> {
    return (await this.ws.findMcpServer(id))?.record ?? null;
  }

  async listByProject(projectId: string): Promise<McpServer[]> {
    const project = await this.ws.findProjectById(projectId);
    if (!project) return [];
    const all = await this.ws.listMcpServers(project.dir);
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listByConnectorInstance(
    connectorInstanceId: string,
  ): Promise<McpServer[]> {
    const all = await this.ws.listAllMcpServers();
    return all
      .filter((s) => s.connectorInstanceId === connectorInstanceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async update(id: string, patch: UpdateMcpServerData): Promise<McpServer> {
    const found = await this.ws.findMcpServer(id);
    if (!found) throw notFound(`MCP server not found: ${id}`);
    const { lastError, ...rest } = patch;
    const updated: McpServer = {
      ...found.record,
      ...(rest.name !== undefined && { name: rest.name }),
      ...(rest.transport !== undefined && { transport: rest.transport }),
      ...(rest.command !== undefined && { command: rest.command }),
      ...(rest.args !== undefined && { args: rest.args }),
      ...(rest.env !== undefined && { env: rest.env }),
      ...(rest.url !== undefined && { url: rest.url }),
      ...(rest.headers !== undefined && { headers: rest.headers }),
      ...(rest.status !== undefined && { status: rest.status }),
      ...(rest.enabled !== undefined && { enabled: rest.enabled }),
      ...(rest.toolCount !== undefined && { toolCount: rest.toolCount }),
      updatedAt: new Date().toISOString(),
    };
    if (lastError === null) delete updated.lastError;
    else if (lastError !== undefined) updated.lastError = lastError;
    await this.ws.writeMcpServer(found.projectDir, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const found = await this.ws.findMcpServer(id);
    if (found) await this.ws.removeMcpServerFile(found.path);
  }
}
