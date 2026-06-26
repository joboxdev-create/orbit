import { Injectable } from "@nestjs/common";
import type { SecretStore } from "@orbit/engine";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CryptoService } from "../../shared/crypto/crypto.service";

/**
 * Postgres-backed {@link SecretStore} for the server host. Credentials are
 * encrypted at rest (AES-256-GCM via {@link CryptoService}) and kept in the
 * `encryptedCredentials` column of the connector instance row, keyed by the
 * instance id. They are never part of the public record returned to clients.
 *
 * On the desktop host the same port is served by a keychain/file store; the
 * engine's connect/invoke logic is identical across both.
 */
@Injectable()
export class PrismaSecretStore implements SecretStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async get(key: string): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.connectorInstance.findUnique({
      where: { id: key },
      select: { encryptedCredentials: true },
    });
    if (!row?.encryptedCredentials) return null;
    return this.crypto.decryptJson<Record<string, unknown>>(
      row.encryptedCredentials,
    );
  }

  async set(key: string, value: Record<string, unknown>): Promise<void> {
    await this.prisma.connectorInstance.update({
      where: { id: key },
      data: { encryptedCredentials: this.crypto.encryptJson(value) },
    });
  }

  async delete(key: string): Promise<void> {
    await this.prisma.connectorInstance.update({
      where: { id: key },
      data: { encryptedCredentials: null },
    });
  }
}
