import { Router, type Response } from "express";
import { AGREEMENT_REQUIRED, deleteAccountSchema, googleSignInSchema, loginSchema, signupSchema } from "@shared/auth/schemas";
import { POLICY_VERSION } from "@shared/legal/business";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../auth/password.js";
import type { Sessions } from "../auth/session.js";
import type { GoogleVerifier } from "../auth/google.js";
import { toPublicUser, type StoredUser, type UserRepository } from "../repositories/users.js";
import type { DesignRepository } from "../repositories/designs.js";
import type { MessageRepository } from "../repositories/messages.js";
import { currentUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import type { GeneratedAssets } from "../privacy/generatedAssets.js";

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Check the form and try again.";

const consentNow = () => ({ consentedAt: new Date().toISOString(), policyVersion: POLICY_VERSION });

export function authRouter(opts: { users: UserRepository; sessions: Sessions; google: GoogleVerifier | null; googleClientId?: string; designs: DesignRepository; messages: MessageRepository; assets: GeneratedAssets; siteConfig?: { googleClientId: string | null; aiProvider: string; meshProvider: string; contactForwardingEnabled: boolean; authCookieName: string } }) {
  const { users, sessions, google, designs, messages, assets } = opts,
    router = Router(),
    limit = rateLimit(10, "Too many attempts. Wait a minute and try again.");
  async function signIn(res: Response, user: StoredUser, status = 200) {
    res.cookie(sessions.cookieName, await sessions.sign(user.id), sessions.cookie);
    res.status(status).json({ user: toPublicUser(user) });
  }
  // The client id is public by design; it is what the Google button needs.
  router.get("/config", (_req, res) => res.json(opts.siteConfig ?? { googleClientId: opts.googleClientId ?? null }));
  router.get("/me", (_req, res) => {
    const u = currentUser(res);
    res.json({ user: u ? toPublicUser(u) : null });
  });
  router.post("/signup", limit, async (req, res) => {
    const p = signupSchema.safeParse(req.body);
    if (!p.success) return void res.status(400).json({ error: firstIssue(p.error) });
    if (await users.byEmail(p.data.email)) return void res.status(409).json({ error: "An account with this email already exists. Log in instead." });
    const user = await users.create({ name: p.data.name, email: p.data.email, passwordHash: await hashPassword(p.data.password), ...consentNow() });
    if (!user) return void res.status(409).json({ error: "An account with this email already exists. Log in instead." });
    await signIn(res, user, 201);
  });
  router.post("/login", limit, async (req, res) => {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) return void res.status(400).json({ error: firstIssue(p.error) });
    const user = await users.byEmail(p.data.email),
      ok = await verifyPassword(p.data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok) {
      const hint = user && !user.passwordHash ? " This account uses Google sign-in." : "";
      return void res.status(401).json({ error: `Email or password is incorrect.${hint}` });
    }
    await signIn(res, user);
  });
  router.post("/google", limit, async (req, res) => {
    if (!google) return void res.status(503).json({ error: "Google sign-in is not configured on this server." });
    const p = googleSignInSchema.safeParse(req.body);
    if (!p.success) return void res.status(400).json({ error: "Missing Google credential." });
    let id;
    try {
      id = await google(p.data.credential);
    } catch {
      return void res.status(401).json({ error: "Google could not confirm this sign-in. Try again." });
    }
    let user = await users.byGoogleId(id.sub);
    if (!user) {
      // Google has verified this email (the verifier refuses unverified ones), which proves the
      // person controls the address. An account with that email and no Google link yet gets
      // linked, so people who signed up with a password can also log in with Google.
      const byEmail = await users.byEmail(id.email);
      if (byEmail) {
        if (byEmail.googleId) return void res.status(409).json({ error: "This email is already linked to a different Google account." });
        user = await users.update(byEmail.id, { googleId: id.sub });
        if (!user) return void res.status(409).json({ error: "Could not link Google to this account. Try again." });
        return void (await signIn(res, user));
      }
      if (!p.data.consent)
        return void res.status(403).json({ error: `No account uses this Google address yet. Sign up first: ${AGREEMENT_REQUIRED}`, code: "consent-required" });
      // A public display name is optional; do not automatically keep Google's full profile name.
      user = await users.create({ email: id.email, name: "Home planner", googleId: id.sub, ...consentNow() });
    }
    if (!user) return void res.status(409).json({ error: "Could not create the account. Try again." });
    await signIn(res, user);
  });
  router.post("/logout", (_req, res) => {
    res.clearCookie(sessions.cookieName, sessions.clearCookie);
    res.json({ ok: true });
  });
  /** Everything held about the signed-in account, as one JSON download. */
  router.get("/export", async (_req, res) => {
    const u = currentUser(res);
    if (!u) return void res.status(401).json({ error: "Please sign in first." });
    const list = await designs.list(u.id),
      full = (await Promise.all(list.map((d) => designs.get(u.id, d.id)))).filter((d) => d !== null);
    res
      .set("Content-Disposition", `attachment; filename="habvion-data-${new Date().toISOString().slice(0, 10)}.json"`)
      .set("Cache-Control", "no-store")
      .json({
        exportedAt: new Date().toISOString(),
        account: { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, signIn: { password: !!u.passwordHash, google: !!u.googleId }, consentedAt: u.consentedAt ?? null, policyVersion: u.policyVersion ?? null },
        designs: full.map((d) => ({ id: d.id, createdAt: d.createdAt, updatedAt: d.updatedAt, shared: !!d.shareToken, design: d.design })),
        messages: (await messages.forUser(u.id)).map(({ userId: _u, ...m }) => m),
        generatedAssets: await assets.listForOwner(u.id),
      });
  });
  /** Erase the account, every design (and so every share link) and the messages it sent. */
  router.post("/delete-account", limit, async (req, res) => {
    const u = currentUser(res);
    if (!u) return void res.status(401).json({ error: "Please sign in first." });
    const p = deleteAccountSchema.safeParse(req.body ?? {});
    if (!p.success) return void res.status(400).json({ error: "Confirm the deletion." });
    if (u.passwordHash ? !(await verifyPassword(p.data.password ?? "", u.passwordHash)) : p.data.confirm !== "DELETE")
      return void res.status(403).json({ error: u.passwordHash ? "That password is incorrect." : 'Type DELETE to confirm.' });
    await assets.revokeAndRemoveOwner(u.id);
    for (const d of await designs.list(u.id)) await designs.remove(u.id, d.id);
    const removedMessages = await messages.removeForUser(u.id);
    await users.remove(u.id);
    res.clearCookie(sessions.cookieName, sessions.clearCookie);
    console.log(`Account deleted on request (${removedMessages} message(s) removed).`);
    res.json({ ok: true });
  });
  return router;
}
