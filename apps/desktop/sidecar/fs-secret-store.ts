import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CryptoEngine, type SecretStore } from "@orbit/engine";

/**
 * Desktop SecretStore: an **encrypted, non-synced local file** (separate from
 * the workspace `.orbit/` manifests, which must stay shareable without
 * secrets). Each connector instance's credentials are stored as an AES-256-GCM
 * blob, keyed by instance id.
 *
 * NOTE: the master key currently lives in a local file (mode 600). Moving it to
 * the OS keychain (via Tauri's Rust side) is a planned hardening step.
 */
export class FileSecretStore implements SecretStore {
  private readonly crypto: CryptoEngine;

  constructor(
    private readonly file: string,
    keyBase64: string,
  ) {
    this.crypto = new CryptoEngine(keyBase64);
  }

  private readMap(): Record<string, string> {
    try {
      return JSON.parse(readFileSync(this.file, "utf8")) as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  }

  private writeMap(map: Record<string, string>): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(map, null, 2), { mode: 0o600 });
  }

  async get(key: string): Promise<Record<string, unknown> | null> {
    const blob = this.readMap()[key];
    return blob
      ? this.crypto.decryptJson<Record<string, unknown>>(blob)
      : null;
  }

  async set(key: string, value: Record<string, unknown>): Promise<void> {
    const map = this.readMap();
    map[key] = this.crypto.encryptJson(value);
    this.writeMap(map);
  }

  async delete(key: string): Promise<void> {
    const map = this.readMap();
    delete map[key];
    this.writeMap(map);
  }
}
