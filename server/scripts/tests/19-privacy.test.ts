import { readFile } from "node:fs/promises";
import { check } from "../check.js";
import { sampleHouse } from "../fixtures.js";
import { POLICY_VERSION } from "@shared/legal/business";
import type { GoogleVerifier } from "../../src/auth/google.js";
import { FileMessageRepository } from "../../src/repositories/messages.js";
import { MESSAGE_RETENTION_DAYS, pruneOldMessages } from "../../src/contact/retention.js";
import { startApp } from "../http.js";

const question = { name: "Asha", email: "asha@example.com", topic: "privacy", message: "Please tell me what you hold about me.", consent: true };

// Consent at sign-up: required, and recorded.
{
  const app = await startApp();
  try {
    const c = app.client();
    const refused = await c.call("/auth/signup", { body: { name: "Asha", email: "asha@example.com", password: "long enough pw" } });
    check("sign-up without the agreement is refused", refused.status === 400 && /18 or older/.test(refused.json.error));
    check("…and creates nothing", (await c.call("/auth/signup", { body: { name: "Asha", email: "asha@example.com", password: "long enough pw", consent: true } })).status === 201);
    const users = JSON.parse(await readFile(app.config.USERS_FILE, "utf8")).users;
    check("only one account exists after the refusal", users.length === 1);
    check("the agreement's date and policy version are recorded", !!users[0].consentedAt && users[0].policyVersion === POLICY_VERSION);
  } finally {
    await app.close();
  }
}

// Download and delete.
{
  const tokens: Record<string, Awaited<ReturnType<GoogleVerifier>>> = { ["g".repeat(30)]: { sub: "google-9", email: "gopi@example.com", name: "Gopi" } };
  const app = await startApp({ GOOGLE_CLIENT_ID: "1.apps.googleusercontent.com" }, { google: async (t) => tokens[t] ?? Promise.reject(new Error("bad")), notify: null });
  try {
    const anon = app.client();
    check("download needs an account", (await anon.call("/auth/export")).status === 401);
    check("delete needs an account", (await anon.call("/auth/delete-account", { body: { password: "x" } })).status === 401);

    const me = app.client(),
      other = app.client();
    await me.call("/auth/signup", { body: { name: "Asha", email: "asha@example.com", password: "long enough pw", consent: true } });
    await other.call("/auth/signup", { body: { name: "Ravi", email: "ravi@example.com", password: "long enough pw", consent: true } });
    const mine = sampleHouse().design,
      theirs = { ...sampleHouse().design, id: "design-ravi-1" };
    await me.call("/designs", { body: { design: mine } });
    await other.call("/designs", { body: { design: theirs } });
    const share = await me.call(`/designs/${mine.id}/share`, { body: {} });
    const token = share.json.token as string;
    check("setup: a shared design is publicly visible", (await anon.call(`/shared/${token}`)).status === 200);
    await me.call("/contact", { body: question });
    await anon.call("/contact", { body: { ...question, name: "Visitor", email: "visitor@example.com" } });

    const exp = await me.call("/auth/export");
    check("download returns the account", exp.status === 200 && exp.json.account.email === "asha@example.com" && exp.json.account.policyVersion === POLICY_VERSION);
    check("…every design in full", exp.json.designs.length === 1 && exp.json.designs[0].design.id === mine.id && exp.json.designs[0].shared === true);
    check("…and messages sent while signed in", exp.json.messages.length === 1 && exp.json.messages[0].email === "asha@example.com");
    check("…never the password hash or other people's data", !exp.text.includes("passwordHash") && !exp.text.includes("$scrypt") && !exp.text.includes("ravi@") && !exp.text.includes("visitor@"));

    const wrong = await me.call("/auth/delete-account", { body: { password: "not my password" } });
    check("a wrong password deletes nothing", wrong.status === 403 && (await me.call("/auth/me")).json.user?.email === "asha@example.com");
    const gone = await me.call("/auth/delete-account", { body: { password: "long enough pw" } });
    check("the right password deletes the account", gone.status === 200);
    check("…and signs the person out", (await me.call("/auth/me")).json.user === null);
    check("…they can no longer log in", (await app.client().call("/auth/login", { body: { email: "asha@example.com", password: "long enough pw" } })).status === 401);
    check("…their share link stops working", (await anon.call(`/shared/${token}`)).status === 404);
    const left = await new FileMessageRepository(app.config.MESSAGES_FILE).list(100);
    check("…their signed-in messages are erased", left.every((m) => m.email !== "asha@example.com"));
    check("…while other people's messages stay", left.some((m) => m.email === "visitor@example.com"));
    check("…and other people's designs stay", (await other.call(`/designs/${theirs.id}`)).status === 200);
    check("the email is free to sign up again", (await app.client().call("/auth/signup", { body: { name: "Asha", email: "asha@example.com", password: "long enough pw", consent: true } })).status === 201);

    const g = app.client();
    await g.call("/auth/google", { body: { credential: "g".repeat(30), consent: true } });
    check("a Google-only account must type DELETE", (await g.call("/auth/delete-account", { body: { confirm: "delete" } })).status === 403);
    check("…and with DELETE it is erased", (await g.call("/auth/delete-account", { body: { confirm: "DELETE" } })).status === 200 && (await g.call("/auth/me")).json.user === null);
  } finally {
    await app.close();
  }
}

// Contact messages are kept for at most two years.
{
  const app = await startApp();
  try {
    const repo = new FileMessageRepository(app.config.MESSAGES_FILE);
    const now = Date.parse("2026-10-22T00:00:00Z");
    await repo.create({ name: "Recent", email: "r@example.com", topic: "general", message: "Recent enough to keep." });
    const old = await repo.create({ name: "Old", email: "o@example.com", topic: "general", message: "Too old to keep now." });
    // Backdate one message past the limit, through the same file the server uses.
    const { JsonFile } = await import("../../src/repositories/jsonFile.js");
    await new JsonFile<{ messages: { id: string; createdAt: string }[] }>(app.config.MESSAGES_FILE, () => ({ messages: [] })).update((d) => {
      d.messages.find((m) => m.id === old.id)!.createdAt = new Date(now - (MESSAGE_RETENTION_DAYS + 1) * 86_400_000).toISOString();
      d.messages.find((m) => m.id !== old.id)!.createdAt = new Date(now - 10 * 86_400_000).toISOString();
    });
    const removed = await pruneOldMessages(new FileMessageRepository(app.config.MESSAGES_FILE), now);
    const remaining = await new FileMessageRepository(app.config.MESSAGES_FILE).list(10);
    check("messages older than two years are deleted", removed === 1 && remaining.length === 1 && remaining[0]?.name === "Recent");
  } finally {
    await app.close();
  }
}
