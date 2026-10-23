import { createRemoteJWKSet, jwtVerify } from "jose";

export type GoogleIdentity = { sub: string; email: string; name?: string };
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

/**
 * Verify a Google ID token on the server: signature against Google's published keys,
 * issuer, audience (our client id), expiry, and a verified email.
 */
export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  return async (idToken) => {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: ["accounts.google.com", "https://accounts.google.com"],
      audience: clientId,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true)
      throw new Error("Google account email is not verified");
    return { sub: payload.sub, email: payload.email.toLowerCase(), name: typeof payload.name === "string" ? payload.name : undefined };
  };
}
