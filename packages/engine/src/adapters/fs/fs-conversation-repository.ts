import { randomUUID } from "node:crypto";
import type {
  Conversation,
  ConversationRepository,
  CreateConversationData,
  UpdateConversationData,
} from "../../domain/conversation.js";
import { notFound } from "../../errors.js";
import { FileWorkspace } from "./file-workspace.js";

/**
 * Filesystem-backed ConversationRepository for the desktop host. Chat sessions
 * live under their project's `.orbit/conversations/<id>.json`.
 */
export class FsConversationRepository implements ConversationRepository {
  private readonly ws: FileWorkspace;

  constructor(workspaceRoot: string | FileWorkspace) {
    this.ws =
      typeof workspaceRoot === "string"
        ? new FileWorkspace(workspaceRoot)
        : workspaceRoot;
  }

  async create(data: CreateConversationData): Promise<Conversation> {
    const project = await this.ws.findProjectById(data.projectId);
    if (!project) throw notFound(`Project not found: ${data.projectId}`);
    const now = new Date().toISOString();
    const record: Conversation = {
      id: randomUUID(),
      projectId: data.projectId,
      title: data.title ?? "New chat",
      ...(data.instanceId !== undefined && { instanceId: data.instanceId }),
      ...(data.model !== undefined && { model: data.model }),
      messages: data.messages ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await this.ws.writeConversation(project.dir, record);
    return record;
  }

  async findById(id: string): Promise<Conversation | null> {
    return (await this.ws.findConversation(id))?.record ?? null;
  }

  async listByProject(projectId: string): Promise<Conversation[]> {
    const project = await this.ws.findProjectById(projectId);
    if (!project) return [];
    const all = await this.ws.listConversations(project.dir);
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async update(
    id: string,
    patch: UpdateConversationData,
  ): Promise<Conversation> {
    const found = await this.ws.findConversation(id);
    if (!found) throw notFound(`Conversation not found: ${id}`);
    const updated: Conversation = {
      ...found.record,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.instanceId !== undefined && { instanceId: patch.instanceId }),
      ...(patch.model !== undefined && { model: patch.model }),
      ...(patch.messages !== undefined && { messages: patch.messages }),
      updatedAt: new Date().toISOString(),
    };
    await this.ws.writeConversation(found.projectDir, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const found = await this.ws.findConversation(id);
    if (found) await this.ws.removeConversationFile(found.path);
  }
}
