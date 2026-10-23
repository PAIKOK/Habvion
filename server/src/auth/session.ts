import { SignJWT, jwtVerify } from "jose";
import type { CookieOptions } from "express";

const ISSUER = "homebuilder-ai",
  TTL_SECONDS = 7 * 24 * 3600;

/** Signed JWT sessions in an httpOnly cookie. The secret comes from the parsed environment. */
export function createSessions(secret: string, cookieName: string, secure: boolean) {
  const key = new TextEncoder().encode(secret);
  const cookie: CookieOptions = { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: TTL_SECONDS * 1000 };
  return {
    cookieName,
    cookie,
    clearCookie: { httpOnly: true, sameSite: "lax", secure, path: "/" } as CookieOptions,
    sign: (userId: string) =>
      new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuer(ISSUER).setIssuedAt().setExpirationTime(`${TTL_SECONDS}s`).sign(key),
    async verify(token: string | undefined): Promise<string | null> {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
        return typeof payload.sub === "string" ? payload.sub : null;
      } catch {
        return null;
      }
    },
  };
}
export type Sessions = ReturnType<typeof createSessions>;
