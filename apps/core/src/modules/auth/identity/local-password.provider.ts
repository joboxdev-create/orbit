import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { IdentityProvider } from "./identity-provider";

/** Local email/password identity using argon2id hashing. */
@Injectable()
export class LocalPasswordProvider implements IdentityProvider {
  readonly name = "local";

  hashSecret(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verifySecret(plain: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
