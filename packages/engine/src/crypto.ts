import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets at rest (e.g. connector credentials).
 * Host-agnostic: works the same embedded in the desktop app or in the server.
 * The 32-byte key is provided as base64. Output format is
 * `iv:authTag:ciphertext`, each part base64.
 */
export class CryptoEngine {
  private readonly key: Buffer;

  constructor(keyBase64: string) {
    const key = Buffer.from(keyBase64, "base64");
    if (key.length !== 32) {
      throw new Error(
        "encryption key must decode to 32 bytes (use: openssl rand -base64 32)",
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString("base64"),
      tag.toString("base64"),
      enc.toString("base64"),
    ].join(":");
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error("Invalid ciphertext format");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }
}
