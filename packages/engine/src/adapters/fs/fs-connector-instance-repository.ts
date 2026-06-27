import { randomUUID } from "node:crypto";
import type {
  ConnectorInstanceRecord,
  ConnectorInstanceRepository,
  CreateConnectorInstanceData,
  UpdateConnectorInstanceData,
} from "../../domain/connector-instance.js";
import { notFound } from "../../errors.js";
import { FileWorkspace } from "./file-workspace.js";

/**
 * Filesystem-backed ConnectorInstanceRepository for the desktop host. Instances
 * live under their project's `.orbit/connectors/<id>.json`. No database.
 */
export class FsConnectorInstanceRepository
  implements ConnectorInstanceRepository
{
  private readonly ws: FileWorkspace;

  constructor(workspaceRoot: string | FileWorkspace) {
    this.ws =
      typeof workspaceRoot === "string"
        ? new FileWorkspace(workspaceRoot)
        : workspaceRoot;
  }

  async create(
    data: CreateConnectorInstanceData,
  ): Promise<ConnectorInstanceRecord> {
    const project = await this.ws.findProjectById(data.projectId);
    if (!project) throw notFound(`Project not found: ${data.projectId}`);

    const record: ConnectorInstanceRecord = {
      id: randomUUID(),
      projectId: data.projectId,
      connectorType: data.connectorType,
      layer: data.layer,
      name: data.name,
      status: data.status ?? "configured",
      config: data.config ?? {},
      disabledCapabilities: [],
      encryptedCredentials: data.encryptedCredentials ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.ws.writeConnector(project.dir, record);
    return record;
  }

  async findById(id: string): Promise<ConnectorInstanceRecord | null> {
    return (await this.ws.findConnector(id))?.record ?? null;
  }

  async findByProject(
    projectId: string,
  ): Promise<ConnectorInstanceRecord[]> {
    const project = await this.ws.findProjectById(projectId);
    if (!project) return [];
    const records = await this.ws.listConnectors(project.dir);
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async update(
    id: string,
    patch: UpdateConnectorInstanceData,
  ): Promise<ConnectorInstanceRecord> {
    const found = await this.ws.findConnector(id);
    if (!found) throw notFound(`Connector instance not found: ${id}`);

    const updated: ConnectorInstanceRecord = {
      ...found.record,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.layer !== undefined && { layer: patch.layer }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.config !== undefined && { config: patch.config }),
      ...(patch.disabledCapabilities !== undefined && {
        disabledCapabilities: patch.disabledCapabilities,
      }),
      ...(patch.encryptedCredentials !== undefined && {
        encryptedCredentials: patch.encryptedCredentials,
      }),
    };
    await this.ws.writeConnector(found.projectDir, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const found = await this.ws.findConnector(id);
    if (!found) throw notFound(`Connector instance not found: ${id}`);
    await this.ws.removeConnectorFile(found.path);
  }
}
