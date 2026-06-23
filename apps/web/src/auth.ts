import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { PlatformRole } from "@orbit/shared";

const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:3001/api";

/**
 * Auth.js (NextAuth) backed by ORBIT's own identity store. The Credentials
 * provider verifies email/password against the core (`POST /auth/login`); the
 * core-issued access token is carried on the (httpOnly) session so server-side
 * fetches can forward it as a Bearer to the ORBIT core. ORBIT is its own login
 * authority — Keycloak is only a connector, never the IdP here.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
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
          tokens: { accessToken: string; refreshToken: string };
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
    jwt({ token, user }) {
      // On sign-in, persist the core tokens and role onto the JWT cookie.
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.platformRole = user.platformRole;
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      if (session.user) {
        session.user.platformRole = token.platformRole;
      }
      return session;
    },
  },
});
