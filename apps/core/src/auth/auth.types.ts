/** Shape attached to `request.user` after a valid access token. */
export interface AuthUser {
  userId: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
}
