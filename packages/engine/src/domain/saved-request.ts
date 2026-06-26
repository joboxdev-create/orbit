// A SavedRequest is a workspace-authored, reusable API call against a connector
// instance — the first "custom / workspace-derived" artifact (conceptually a
// user-defined capability). It carries only call parameters; never credentials.

export interface SavedRequest {
  id: string;
  projectId: string;
  instanceId: string;
  name: string;
  /** Groups it among capabilities; defaults to "saved". */
  topic: string;
  operationId?: string;
  method?: string;
  path?: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  createdAt: string;
}

export interface CreateSavedRequestData {
  instanceId: string;
  name: string;
  topic?: string;
  operationId?: string;
  method?: string;
  path?: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

/** Persistence port; filesystem on desktop, (future) Prisma on the server. */
export interface SavedRequestRepository {
  create(data: CreateSavedRequestData): Promise<SavedRequest>;
  listByInstance(instanceId: string): Promise<SavedRequest[]>;
  delete(id: string): Promise<void>;
}
