// ConnectorInstance — a connector configured inside a project. It belongs to a
// project (the org, if any, is reached via the project), so it is fully
// host-neutral: the same shape persists in a desktop file store or a server DB.

/**
 * Lifecycle status of an instance. `configured` = registered, no live
 * connection yet; `connected` = credentials verified via testConnection.
 * `error`/`disconnected` are reserved for the lifecycle work still to come.
 */
export type ConnectorInstanceStatus =
  | "configured"
  | "connected"
  | "error"
  | "disconnected";

export interface ConnectorInstanceRecord {
  id: string;
  projectId: string;
  /** Registry connector type id, or the `custom` sentinel for local services. */
  connectorType: string;
  layer: string;
  name: string;
  status: ConnectorInstanceStatus;
  /** Non-secret, connector-defined configuration. */
  config: Record<string, unknown>;
  /** AES-256-GCM blob (see CryptoEngine); `null` until credentials are set. */
  encryptedCredentials: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface CreateConnectorInstanceData {
  projectId: string;
  connectorType: string;
  layer: string;
  name: string;
  status?: ConnectorInstanceStatus;
  config?: Record<string, unknown>;
  encryptedCredentials?: string | null;
}

export interface UpdateConnectorInstanceData {
  name?: string;
  layer?: string;
  status?: ConnectorInstanceStatus;
  config?: Record<string, unknown>;
  encryptedCredentials?: string | null;
}

/**
 * Persistence port for connector instances. Implemented by a filesystem adapter
 * (desktop) and a Prisma/Postgres adapter (server).
 */
export interface ConnectorInstanceRepository {
  create(
    data: CreateConnectorInstanceData,
  ): Promise<ConnectorInstanceRecord>;
  findById(id: string): Promise<ConnectorInstanceRecord | null>;
  findByProject(projectId: string): Promise<ConnectorInstanceRecord[]>;
  update(
    id: string,
    patch: UpdateConnectorInstanceData,
  ): Promise<ConnectorInstanceRecord>;
  delete(id: string): Promise<void>;
}

/** Sentinel connectorType for user-declared services without a code connector. */
export const CUSTOM_CONNECTOR_TYPE = "custom";
