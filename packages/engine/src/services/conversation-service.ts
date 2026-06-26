import type {
  Conversation,
  ConversationRepository,
  CreateConversationData,
  UpdateConversationData,
} from "../domain/conversation.js";

/** Host-neutral CRUD for chat sessions (conversations). */
export class ConversationService {
  constructor(private readonly repo: ConversationRepository) {}

  create(data: CreateConversationData): Promise<Conversation> {
    return this.repo.create({
      ...data,
      title: data.title?.trim() || "New chat",
    });
  }

  get(id: string): Promise<Conversation | null> {
    return this.repo.findById(id);
  }

  listByProject(projectId: string): Promise<Conversation[]> {
    return this.repo.listByProject(projectId);
  }

  update(id: string, patch: UpdateConversationData): Promise<Conversation> {
    return this.repo.update(id, patch);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
