/**
 * Pluggable secret storage, kept **separate** from the (syncable) connector
 * instance record — credentials must never live in the `.orbit/` manifest that
 * gets shared/synced. The host provides the implementation:
 *  - **server**  → encrypted at rest in the database (CryptoEngine),
 *  - **desktop** → the OS keychain / a local, non-synced encrypted store.
 *
 * Keyed by connector instance id. The stored value is the connector's
 * credentials object (its shape is the connector's `credentialsSchema`).
 */
export interface SecretStore {
  get(key: string): Promise<Record<string, unknown> | null>;
  set(key: string, value: Record<string, unknown>): Promise<void>;
  delete(key: string): Promise<void>;
}
