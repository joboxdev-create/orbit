import type { DefaultSession } from "next-auth";
import "next-auth/jwt";
import type { PlatformRole } from "@orbit/shared";

declare module "next-auth" {
  interface Session {
    /** ORBIT core access token, forwarded as Bearer to the core. */
    accessToken?: string;
    /** Set to "RefreshError" when the refresh token has expired. The auth gate
     *  redirects to /login when this is present. */
    error?: string;
    user: {
      platformRole?: PlatformRole;
    } & DefaultSession["user"];
  }

  interface User {
    platformRole?: PlatformRole;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    platformRole?: PlatformRole;
    /** Unix ms timestamp when the ORBIT access token expires. */
    accessTokenExpires?: number;
    /** "RefreshError" when the refresh call failed (e.g. refresh token expired). */
    error?: string;
  }
}
