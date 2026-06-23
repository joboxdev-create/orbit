import { z } from "zod";
import { LayerKind } from "./layers.js";

/**
 * A ConnectorInstance is a concrete, configured connection of a project
 * to an external service (e.g. "the acme-org GitHub org"). It references
 * a connector *type* (provided by a separate @orbit/connector-* package)
 * and holds the per-project configuration + credentials reference.
 *
 * The core never depends on connector packages directly: it only stores
 * instances and talks to them through the @orbit/connector-sdk contract.
 */
export const ConnectorStatus = z.enum([
  "configured",
  "connected",
  "error",
  "disabled",
]);
export type ConnectorStatus = z.infer<typeof ConnectorStatus>;

export const ConnectorInstance = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  /** Stable id of the connector type, e.g. "github". */
  connectorType: z.string().min(1),
  layer: LayerKind,
  name: z.string().min(1).max(120),
  status: ConnectorStatus,
  /** Opaque, connector-defined non-secret configuration. */
  config: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type ConnectorInstance = z.infer<typeof ConnectorInstance>;

export const CreateConnectorInstance = ConnectorInstance.pick({
  projectId: true,
  connectorType: true,
  name: true,
  config: true,
});
export type CreateConnectorInstance = z.infer<typeof CreateConnectorInstance>;
