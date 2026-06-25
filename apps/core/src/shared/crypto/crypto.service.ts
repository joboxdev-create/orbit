import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CryptoEngine } from "@orbit/engine";

/**
 * NestJS adapter over the host-agnostic {@link CryptoEngine}. Reads the 32-byte
 * key from ORBIT_ENCRYPTION_KEY (base64) and delegates the actual AES-256-GCM
 * work to the engine, so server and desktop share the exact same crypto.
 */
@Injectable()
export class CryptoService {
  private readonly engine: CryptoEngine;

  constructor(config: ConfigService) {
    const raw = config.get<string>("ORBIT_ENCRYPTION_KEY");
    if (!raw) {
      throw new Error("ORBIT_ENCRYPTION_KEY is not set");
    }
    this.engine = new CryptoEngine(raw);
  }

  encrypt(plaintext: string): string {
    return this.engine.encrypt(plaintext);
  }

  decrypt(payload: string): string {
    return this.engine.decrypt(payload);
  }

  encryptJson(value: unknown): string {
    return this.engine.encryptJson(value);
  }

  decryptJson<T>(payload: string): T {
    return this.engine.decryptJson<T>(payload);
  }
}
