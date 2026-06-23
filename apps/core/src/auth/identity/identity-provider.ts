/**
 * Abstraction over how a user's secret is established and verified. Today the
 * only implementation is local password hashing; an OIDC/Keycloak provider can
 * be added later (validating external tokens / provisioning users) without the
 * rest of the auth code changing. This is the "OIDC-ready seam".
 */
export interface IdentityProvider {
  readonly name: string;
  hashSecret(plain: string): Promise<string>;
  verifySecret(plain: string, hash: string): Promise<boolean>;
}

export const IDENTITY_PROVIDER = "IDENTITY_PROVIDER";
