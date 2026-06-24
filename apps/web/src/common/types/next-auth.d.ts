import type { DefaultSession } from "next-auth";
import "next-auth/jwt";
import type { PlatformRole } from "@orbit/shared";

declare module "next-auth" {
  interface Session {
    /** ORBIT core access token, forwarded as Bearer to the core. */
    accessToken?: string;
    user: {
      platformRole?: PlatformRole;
    } & DefaultSession["user"];
  }

  /** Returned by the Credentials `authorize` callback. */
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
  }
}
