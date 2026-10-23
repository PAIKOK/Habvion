import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import { check } from "../check.js";
import { contactSchema } from "@shared/contact/schema";
import { FileMessageRepository } from "../../src/repositories/messages.js";
import { createContactNotifier } from "../../src/contact/notify.js";
import { parseEnvironment } from "../../src/config/envSchema.js";
import { startApp } from "../http.js";

const good = { name: "Asha Rao", email: "Asha@Example.com", phone: "+91 98450 12345", topic: "costs", message: "How accurate is the estimate for a 30×40 plot?", consent: true as const };

// The shared rules, as the form and the server both apply them.
{
  const ok = contactSchema.safeParse(good);
  check("a complete message is accepted", ok.success && ok.data.email === "asha@example.com");
  check("the phone is optional", contactSchema.safeParse({ ...good, phone: "" }).success && contactSchema.safeParse({ ...good, phone: undefined }).success);
  const reasons = (patch: object) => {
    const r = contactSchema.safeParse({ ...good, ...patch });
    return r.success ? "" : r.error.issues[0]!.message;
  };
  check("a name is required", /your name/.test(reasons({ name: "  " })));
  check("a real email is required", /valid email/.test(reasons({ email: "asha@" })));
  check("a phone with letters is refused", /phone number/.test(reasons({ phone: "call me" })));
  check("an unknown topic is refused", /about/.test(reasons({ topic: "sales-pitch" })));
  check("a one-word message is refused", /at least a sentence/.test(reasons({ message: "hi" })));
  check("a very long message is refused", /4,000/.test(reasons({ message: "x".repeat(4001) })));
  check("no tick box is needed to send a message (the age and terms agreement is for sign-up only)", contactSchema.safeParse({ ...good, consent: undefined }).success && contactSchema.safeParse({ ...good, consent: false }).success);
}

// The route: public, validated, stored privately, never readable over HTTP.
{
  const app = await startApp();
  try {
    const anon = app.client();
    const sent = await anon.call("/contact", { body: good });
    check("anyone can send a message without signing in", sent.status === 201);
    check("the sender gets a reference to quote", /^HB-[2-9A-HJ-NP-Z]{6}$/.test(sent.json?.reference ?? ""), sent.json?.reference);
    const repo = new FileMessageRepository(app.config.MESSAGES_FILE);
    let stored = (await repo.list())[0];
    check("the message is stored as sent", stored?.id === sent.json.reference && stored?.name === "Asha Rao" && stored?.email === "asha@example.com" && stored?.topic === "costs" && stored?.phone === "+91 98450 12345");
    check("an anonymous message has no account attached", stored?.userId === undefined);
    check("the messages file is private (600)", ((await stat(app.config.MESSAGES_FILE)).mode & 0o777) === 0o600);

    const bad = await anon.call("/contact", { body: { ...good, email: "nope" } });
    check("an invalid message is a 400 with the reason", bad.status === 400 && /valid email/.test(bad.json?.error));
    check("an empty body is a 400", (await anon.call("/contact", { body: {} })).status === 400);

    const bot = await anon.call("/contact", { body: { ...good, message: "Buy cheap followers now at my site", website: "http://spam.example" } });
    check("a bot that fills the hidden field is told it worked", bot.status === 201 && /^HB-/.test(bot.json?.reference ?? ""));
    check("…but nothing is kept", (await repo.list()).every((m) => !m.message.includes("followers")));

    const member = app.client();
    await member.call("/auth/signup", { body: { consent: true, name: "Ravi", email: `contact-${Date.now()}@homebuilder.test`, password: "a long enough password" } });
    const mine = await member.call("/contact", { body: { ...good, name: "Ravi", topic: "design-help", phone: "" } });
    stored = (await new FileMessageRepository(app.config.MESSAGES_FILE).list())[0];
    check("a signed-in sender's account is attached", mine.status === 201 && stored?.id === mine.json.reference && !!stored?.userId && stored?.phone === undefined);
    check("messages are listed newest first", stored?.name === "Ravi");

    check("messages cannot be read back over HTTP", (await member.call("/contact")).status === 404);
  } finally {
    await app.close();
  }
}

// Campaign tags from the arrival link are kept with the message, cleaned, and never required.
{
  const app = await startApp();
  try {
    const c = app.client();
    const repo = () => new FileMessageRepository(app.config.MESSAGES_FILE);
    const tagged = await c.call("/contact", { body: { ...good, utm: { source: "instagram", medium: "social", campaign: "diwali-2026", content: "  reel-1  " } } });
    let stored = (await repo().list())[0];
    check("campaign tags are stored with the message", tagged.status === 201 && stored?.utm?.source === "instagram" && stored?.utm?.campaign === "diwali-2026" && stored?.utm?.content === "reel-1");
    check("…only the tags that were present", stored?.utm !== undefined && !("term" in stored.utm));
    await c.call("/contact", { body: good });
    stored = (await repo().list())[0];
    check("a message without tags stores none", stored?.utm === undefined);
    const odd = await c.call("/contact", { body: { ...good, utm: { source: "x".repeat(500), medium: "<script>" } } });
    stored = (await repo().list())[0];
    check("oversized or unsafe tags never block a message, and are not stored", odd.status === 201 && stored?.id === odd.json.reference && stored?.utm === undefined);
    const notObject = await c.call("/contact", { body: { ...good, utm: "facebook" } });
    check("…nor do malformed ones", notObject.status === 201 && (await repo().list())[0]?.utm === undefined);
  } finally {
    await app.close();
  }
}

// A burst from one address is slowed down.
{
  const app = await startApp();
  try {
    const c = app.client(),
      codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await c.call("/contact", { body: { ...good, message: `Question number ${i} about my plot.` } })).status);
    check("five messages a minute, then a 429", codes.slice(0, 5).every((s) => s === 201) && codes[5] === 429, codes.join(","));
    check("the data folder holds the messages file", (await stat(join(app.dir, "messages.json"))).isFile());
  } finally {
    await app.close();
  }
}

// Missing fields are explained in words, not as a type error.
{
  const r = contactSchema.safeParse({});
  check("an empty form asks for the name first, in plain words", !r.success && r.error.issues[0]!.message === "Tell us your name.");
  const noEmail = contactSchema.safeParse({ ...good, email: undefined });
  check("a missing email is explained", !noEmail.success && noEmail.error.issues[0]!.message === "Enter a valid email address.");
}

// Google Sheets + email: each enquiry is passed to the Apps Script web app.
{
  const SECRET = "test-secret-0123456789abcdef-not-real";
  const received: any[] = [];
  let mode: "ok" | "html" | "401" | "500" = "ok";
  // A stand-in for the Apps Script: checks the secret and answers the way doPost does.
  const fake = createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    if (mode === "500") return void res.writeHead(500).end("boom");
    if (mode === "401") return void res.writeHead(401, { "content-type": "text/html" }).end("<title>Page Not Found</title>");
    if (mode === "html") return void res.writeHead(200, { "content-type": "text/html" }).end("<html>Sign in to continue</html>");
    const data = JSON.parse(body);
    received.push({ ...data, contentType: req.headers["content-type"] });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(data.secret === SECRET ? { ok: true } : { ok: false, error: "unauthorised" }));
  });
  fake.listen(0, "127.0.0.1");
  await once(fake, "listening");
  const url = `http://127.0.0.1:${(fake.address() as { port: number }).port}/exec`;

  const env = (patch: Record<string, string>) => {
    try {
      parseEnvironment({ SESSION_SECRET: "x".repeat(40), ...patch });
      return "ok";
    } catch (e) {
      return (e as Error).message;
    }
  };
  check("settings: off unless configured", createContactNotifier({}) === undefined);
  check("settings: off unless switched on, even with a URL and secret", createContactNotifier({ CONTACT_WEBHOOK_URL: "https://script.google.com/x", CONTACT_WEBHOOK_SECRET: SECRET }) === undefined);
  check("settings: a URL needs the secret", /CONTACT_WEBHOOK_SECRET/.test(env({ CONTACT_WEBHOOK_URL: "https://script.google.com/macros/s/abc/exec" })));
  check("settings: the URL must be https", /https/.test(env({ CONTACT_WEBHOOK_URL: "http://script.google.com/x", CONTACT_WEBHOOK_SECRET: SECRET })));
  check("settings: a short secret is refused", /24 characters/.test(env({ CONTACT_WEBHOOK_URL: "https://script.google.com/x", CONTACT_WEBHOOK_SECRET: "short" })));
  check("settings: never echo the secret", !env({ CONTACT_WEBHOOK_URL: "http://x.example", CONTACT_WEBHOOK_SECRET: SECRET }).includes(SECRET));

  const notify = createContactNotifier({ CONTACT_WEBHOOK_URL: url, CONTACT_WEBHOOK_SECRET: SECRET, CONTACT_FORWARDING_ENABLED: true })!;
  const app = await startApp({}, { notify });
  const errors: string[] = [],
    realError = console.error;
  console.error = (...a: unknown[]) => void errors.push(a.join(" "));
  try {
    const sent = await app.client().call("/contact", { body: { ...good, topic: "design-help", message: "=HYPERLINK(\"http://evil\") please help with my plan" } });
    check("the visitor gets their answer straight away", sent.status === 201);
    for (let i = 0; i < 40 && !received.length; i++) await new Promise((r) => setTimeout(r, 50));
    const got = received[0];
    check("the enquiry reaches the script", got?.reference === sent.json.reference);
    check("…with every field and a readable topic", got?.name === "Asha Rao" && got?.email === "asha@example.com" && got?.phone === "" && got?.topicLabel === "Help with my design" && got?.signedIn === false && !!got?.receivedAt);
    check("…and the secret, in the body", got?.secret === SECRET && /^text\/plain/.test(got?.contentType ?? ""));
    check("the server does not rewrite the message (the script neutralises formulas)", got?.message.startsWith("=HYPERLINK"));

    const wrong = createContactNotifier({ CONTACT_WEBHOOK_URL: url, CONTACT_WEBHOOK_SECRET: "a-different-secret-0123456789", CONTACT_FORWARDING_ENABLED: true })!;
    const reason = async (n: typeof notify) => n({ id: "HB-TEST22", name: "T", email: "t@example.com", topic: "general", message: "Testing the notifier.", createdAt: new Date().toISOString() }).then(() => "sent", (e: Error) => e.message);
    check("a wrong secret is explained", /refused the secret/.test(await reason(wrong)));
    mode = "html";
    check("a private deployment is explained", /Who has access/.test(await reason(notify)));
    mode = "401";
    check("a sign-in-only deployment is explained", /Who has access/.test(await reason(notify)) && /personal Gmail/.test(await reason(notify)));
    mode = "500";
    check("a broken deployment is explained", /answered 500/.test(await reason(notify)));
    const gone = createContactNotifier({ CONTACT_WEBHOOK_URL: "http://127.0.0.1:9/exec", CONTACT_WEBHOOK_SECRET: SECRET, CONTACT_FORWARDING_ENABLED: true })!;
    check("an unreachable script is explained", /could not be reached/.test(await reason(gone)));

    // Google down: the visitor still succeeds and the message is still kept.
    const before = (await new FileMessageRepository(app.config.MESSAGES_FILE).list(500)).length;
    const still = await app.client().call("/contact", { body: { ...good, message: "Sent while Google is failing." } });
    for (let i = 0; i < 40 && !errors.some((e) => e.includes(still.json?.reference)); i++) await new Promise((r) => setTimeout(r, 50));
    check("when Google fails the visitor still succeeds", still.status === 201);
    check("…and the message is still saved", (await new FileMessageRepository(app.config.MESSAGES_FILE).list(500)).length === before + 1);
    check("…and the failure is logged by reference", errors.some((e) => e.includes(still.json.reference) && /not sent to Google Sheets/.test(e)));
    check("no log line ever contains the secret or the message", errors.every((e) => !e.includes(SECRET) && !e.includes("Google is failing")));
  } finally {
    console.error = realError;
    await app.close();
    fake.close();
  }
}
