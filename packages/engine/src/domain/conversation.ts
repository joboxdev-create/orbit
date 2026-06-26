import type { ChatMessage } from "@orbit/connector-sdk";

// A Conversation is a saved chat session — a workspace artifact (like a saved
// request): files in `.orbit/conversations/`, sync-friendly, no secrets.

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  /** The model connector + model this session uses (so it reopens as-is). */
  instanceId?: string;
  model?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationData {
  projectId: string;
  title?: string;
  instanceId?: string;
  model?: string;
  messages?: ChatMessage[];
}

export interface UpdateConversationData {
  title?: string;
  instanceId?: string;
  model?: string;
  messages?: ChatMessage[];
}

export interface ConversationRepository {
  create(data: CreateConversationData): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
  listByProject(projectId: string): Promise<Conversation[]>;
  update(id: string, patch: UpdateConversationData): Promise<Conversation>;
  delete(id: string): Promise<void>;
}
