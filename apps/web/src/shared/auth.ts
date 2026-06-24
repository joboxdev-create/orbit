import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import type { AuthTokens, PlatformRole } from "@orbit/shared";

const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:3001/api";

/** 30-second buffer: refresh before the token actually expires. */
const REFRESH_BUFFER_MS = 30_000;

/** Decode the `exp` field from a JWT payload without verifying the signature. */
function decodeExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${CORE_API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
    const tokens = (await res.json()) as AuthTokens;
    return {
      ...token,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpires:
        decodeExpiry(tokens.accessToken) ?? Date.now() + 15 * 60 * 1000,
      error: undefined,
    };
  } catch {
    // Mark the session as broken; the auth gate will redirect to /login.
    return { ...token, error: "RefreshError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  // 8-hour session matches the refresh token TTL on the core.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const res = await fetch(`${CORE_API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          user: {
            id: string;
            email: string;
            name?: string | null;
            platformRole: PlatformRole;
          };
          tokens: AuthTokens;
        };
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name ?? null,
          platformRole: data.user.platformRole,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in: populate token from the Credentials authorize return value.
      if (user) {
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          platformRole: user.platformRole,
          accessTokenExpires:
            decodeExpiry(user.accessToken!) ?? Date.now() + 15 * 60 * 1000,
          error: undefined,
        };
      }

      // Access token still valid: return as-is.
      if (Date.now() < (token.accessTokenExpires ?? 0) - REFRESH_BUFFER_MS) {
        return token;
      }

      // Access token expired or about to expire: attempt silent refresh.
      return refreshAccessToken(token);
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      if (session.user) {
        session.user.platformRole = token.platformRole;
      }
      return session;
    },
  },
});
