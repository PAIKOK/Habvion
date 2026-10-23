import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { check } from "../check.js";
import { startApp } from "../http.js";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";
import { createSessions } from "../../src/auth/session.js";
import type { GoogleVerifier } from "../../src/auth/google.js";

// --- password hashing
{
  const h = await hashPassword("correct horse battery");
  check("hash uses the scrypt$N$r$p$salt$hash format", /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(h));
  check("correct password verifies", await verifyPassword("correct horse battery", h));
  check("wrong password fails", !(await verifyPassword("correct horse batterY", h)));
  check("same password, different salt", h !== (await hashPassword("correct horse battery")));
  check("malformed or hostile hashes fail closed", !(await verifyPassword("x", "md5$abc")) && !(await verifyPassword("x", "scrypt$99999999$8$1$AA==$AA==")));
}
// --- sessions
{
  const s = createSessions("x".repeat(40), "hb", false),
    other = createSessions("y".repeat(40), "hb", false),
    t = await s.sign("user-1");
  check("session round-trips its user id", (await s.verify(t)) === "user-1");
  check("a token signed with another secret is refused", (await other.verify(t)) === null);
  check("a tampered token is refused", (await s.verify(t.slice(0, -2) + (t.endsWith("A") ? "BB" : "AA"))) === null);
  check("cookie is httpOnly and SameSite=Lax", s.cookie.httpOnly === true && s.cookie.sameSite === "lax");
  check("cookie is Secure in production", createSessions("x".repeat(40), "hb", true).cookie.secure === true);
}
// --- email and password over HTTP
const app = await startApp();
{
  const c = app.client();
  check("anonymous /me is null", (await c.call("/auth/me")).json.user === null);
  check("config reports Google unavailable without a client id", (await c.call("/auth/config")).json.googleClientId === null);
  check("short password refused", (await c.call("/auth/signup", { body: { consent: true, name: "A", email: "a@example.com", password: "short" } })).status === 400);
  check("bad email refused", (await c.call("/auth/signup", { body: { consent: true, name: "A", email: "nope", password: "long enough pw" } })).status === 400);
  const up = await c.call("/auth/signup", { body: { consent: true, name: "Asha Rao", email: "Asha@Example.com", password: "long enough pw" } });
  check("signup creates and signs in", up.status === 201 && up.json.user.email === "asha@example.com" && up.json.user.hasPassword === true);
  const set = up.setCookie.join(";");
  check("session cookie is HttpOnly and SameSite=Lax", /HttpOnly/i.test(set) && /SameSite=Lax/i.test(set) && /hb_session=/.test(set));
  check("no hash or secret in the response", !JSON.stringify(up.json).includes("scrypt") && !("passwordHash" in up.json.user));
  check("/me knows the user", (await c.call("/auth/me")).json.user?.name === "Asha Rao");
  check("duplicate email refused", (await app.client().call("/auth/signup", { body: { consent: true, name: "B", email: "asha@example.com", password: "another long pw" } })).status === 409);
  check("logout clears the session", (await c.call("/auth/logout", { body: {} })).status === 200 && (await c.call("/auth/me")).json.user === null);
  const wrong = await c.call("/auth/login", { body: { email: "asha@example.com", password: "not the password" } });
  const nobody = await c.call("/auth/login", { body: { email: "nobody@example.com", password: "not the password" } });
  check("wrong password and unknown email look the same", wrong.status === 401 && nobody.status === 401 && wrong.json.error === nobody.json.error);
  const ok = await c.call("/auth/login", { body: { email: "ASHA@example.com ", password: "long enough pw" } });
  check("login is case-insensitive on email", ok.status === 200 && (await c.call("/auth/me")).json.user?.email === "asha@example.com");
  const forged = app.client();
  forged.cookie = "hb_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.";
  check("an unsigned token does not sign anyone in", (await forged.call("/auth/me")).json.user === null);
  const file = join(app.dir, "users.json"),
    mode = (await stat(file)).mode & 0o777;
  check("users file is private (600)", mode === 0o600, mode.toString(8));
  const raw = await readFile(file, "utf8");
  check("stored password is a hash, never the password", raw.includes("scrypt$") && !raw.includes("long enough pw"));
  check("Google sign-in reports itself unavailable", (await c.call("/auth/google", { body: { credential: "x".repeat(40) } })).status === 503);
  // Brute force is throttled.
  let limited = false;
  for (let i = 0; i < 12; i++) if ((await app.client().call("/auth/login", { body: { email: "asha@example.com", password: "guess " + i } })).status === 429) limited = true;
  check("repeated logins are rate limited", limited);
}
await app.close();

// --- Google sign-in with an injected verifier (no network)
{
  const tokens: Record<string, Awaited<ReturnType<GoogleVerifier>>> = {
    ["g".repeat(30)]: { sub: "google-1", email: "ravi@example.com", name: "Ravi" },
    ["h".repeat(30)]: { sub: "google-2", email: "asha@example.com", name: "Asha" },
    ["i".repeat(30)]: { sub: "google-3", email: "asha@example.com", name: "Someone else" },
  };
  const verifier: GoogleVerifier = async (t) => {
    const id = tokens[t];
    if (!id) throw new Error("bad token");
    return id;
  };
  const g = await startApp({ GOOGLE_CLIENT_ID: "123.apps.googleusercontent.com" }, { google: verifier });
  const c = g.client();
  check("config exposes only the public client id", (await c.call("/auth/config")).json.googleClientId === "123.apps.googleusercontent.com");
  const refused = await c.call("/auth/google", { body: { credential: "g".repeat(30) } });
  check("Google will not create an account without the age and terms agreement", refused.status === 403 && refused.json.code === "consent-required" && /18 or older/.test(refused.json.error));
  check("…and no session is started", !c.cookie);
  const first = await c.call("/auth/google", { body: { credential: "g".repeat(30), consent: true } });
  check("Google creates an account once agreed", first.status === 200 && first.json.user.google === true && first.json.user.hasPassword === false);
  const { readFile } = await import("node:fs/promises");
  const { POLICY_VERSION } = await import("@shared/legal/business");
  const stored = JSON.parse(await readFile(g.config.USERS_FILE, "utf8")).users.find((u: { email: string }) => u.email === "ravi@example.com");
  check("the agreement is recorded with its date and policy version", !!stored?.consentedAt && stored?.policyVersion === POLICY_VERSION);
  const again = await g.client().call("/auth/google", { body: { credential: "g".repeat(30) } });
  check("Google signs the same person back in", again.json.user.id === first.json.user.id);
  check("an invalid Google token is refused", (await g.client().call("/auth/google", { body: { credential: "z".repeat(30) } })).status === 401);
  const pw = g.client();
  const made = await pw.call("/auth/signup", { body: { consent: true, name: "Asha", email: "asha@example.com", password: "long enough pw" } });
  const linked = await g.client().call("/auth/google", { body: { credential: "h".repeat(30) } });
  check("a verified Google email links to the existing account", linked.json.user.id === made.json.user.id && linked.json.user.google && linked.json.user.hasPassword);
  const hijack = await g.client().call("/auth/google", { body: { credential: "i".repeat(30) } });
  check("a different Google account cannot take over an already-linked email", hijack.status === 409);
  const pwLogin = await g.client().call("/auth/login", { body: { email: "ravi@example.com", password: "anything long" } });
  check("password login on a Google-only account explains why", pwLogin.status === 401 && pwLogin.json.error.includes("Google"));
  await g.close();
}
