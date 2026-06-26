import type {
  CreateSavedRequestData,
  SavedRequest,
  SavedRequestRepository,
} from "../domain/saved-request.js";
import { badRequest } from "../errors.js";

/**
 * Host-neutral CRUD for {@link SavedRequest}s. Running one is not modelled here:
 * the host simply replays the stored parameters through
 * {@link ConnectorInstanceService.callApi}, reusing the connection's credentials.
 */
export class SavedRequestService {
  constructor(private readonly repo: SavedRequestRepository) {}

  async create(data: CreateSavedRequestData): Promise<SavedRequest> {
    if (!data.name?.trim()) throw badRequest("Saved request needs a name");
    if (!data.operationId && !(data.method && data.path)) {
      throw badRequest("Saved request needs an operationId or method + path");
    }
    return this.repo.create({ ...data, topic: data.topic?.trim() || "saved" });
  }

  listByInstance(instanceId: string): Promise<SavedRequest[]> {
    return this.repo.listByInstance(instanceId);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
